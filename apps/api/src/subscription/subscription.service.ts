import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { InjectStripeClient, StripeWebhookHandler } from '@golevelup/nestjs-stripe';
import { PrismaService } from '@/common/prisma.service';
import {
  CreateCheckoutSessionRequest,
  ModelTier,
  PriceLookupKey,
  User,
} from '@refly/openapi-schema';
import { genUsageMeterID, getSubscriptionInfoFromLookupKey } from '@refly/utils';
import { CreateSubscriptionParam, ReportTokenUsageJobData } from '@/subscription/subscription.dto';
import { pick } from '@/utils';
import { Subscription as SubscriptionModel, User as UserModel } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SubscriptionService {
  private logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectStripeClient() private readonly stripeClient: Stripe,
  ) {}

  async createCheckoutSession(user: UserModel, param: CreateCheckoutSessionRequest) {
    const { uid } = user;
    const { lookupKey } = param;

    const prices = await this.stripeClient.prices.list({
      lookup_keys: [lookupKey],
      expand: ['data.product'],
    });
    if (prices.data.length === 0) {
      throw new BadRequestException(`No prices found for lookup key: ${lookupKey}`);
    }

    const price = prices.data[0];
    const session = await this.stripeClient.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: this.config.get('stripe.sessionSuccessUrl'),
      cancel_url: this.config.get('stripe.sessionCancelUrl'),
      client_reference_id: uid,
      customer_email: user.email,
    });

    await this.prisma.checkoutSession.create({
      data: {
        uid,
        sessionId: session.id,
        lookupKey,
      },
    });

    return session;
  }

  async createPortalSession(user: UserModel) {
    const session = await this.stripeClient.billingPortal.sessions.create({
      customer: user.customerId,
      return_url: this.config.get('stripe.portalReturnUrl'),
    });
    return session;
  }

  async getSubscription(subscriptionId: string) {
    return this.prisma.subscription.findUnique({
      where: { subscriptionId },
    });
  }

  async createSubscription(user: UserModel, param: CreateSubscriptionParam) {
    // Check for existing subscription
    if (user.subscriptionId) {
      const subscription = await this.getSubscription(user.subscriptionId);
      if (subscription.status === 'active') {
        return subscription;
      }
    }

    // Create a new subscription if needed
    const sub = await this.prisma.subscription.create({
      data: {
        ...param,
        uid: user.uid,
      },
    });

    // Update user's subscriptionId
    await this.prisma.user.update({
      where: { uid: user.uid },
      data: { subscriptionId: sub.subscriptionId },
    });

    // Create a new usage meter for this plan
    await this.createUsageMeter(user, sub, false);

    return sub;
  }

  async postSubscriptionCanceled(sub: SubscriptionModel) {
    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { uid: sub.uid },
        data: { subscriptionId: null },
      }),
      this.prisma.usageMeter.updateMany({
        where: { subscriptionId: sub.subscriptionId },
        data: { deletedAt: new Date() },
      }),
    ]);

    if (!user) {
      this.logger.error(`User ${sub.uid} not found for subscription ${sub.subscriptionId}`);
      return;
    }

    // Create a free usage meter for user
    await this.createUsageMeter(user, null, false);
  }

  @StripeWebhookHandler('checkout.session.completed')
  async handleCheckoutSessionCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;
    this.logger.log(`Checkout session completed: ${JSON.stringify(session)}`);

    if (session.payment_status !== 'paid') {
      this.logger.warn(`Checkout session ${session.id} not paid`);
      return;
    }

    const uid = session.client_reference_id;
    const customerId = session.customer as string;

    const checkoutSession = await this.prisma.checkoutSession.findFirst({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!checkoutSession) {
      this.logger.error(`No checkout session found for session ${session.id}`);
      return;
    }

    if (checkoutSession.uid !== uid) {
      this.logger.error(`Checkout session ${session.id} does not match user ${uid}`);
      return;
    }

    await this.prisma.checkoutSession.update({
      where: { pk: checkoutSession.pk },
      data: {
        paymentStatus: session.payment_status,
        subscriptionId: session.subscription as string,
      },
    });

    if (session.payment_status !== 'paid') {
      this.logger.log(`Checkout session ${session.id} is not paid`);
      return;
    }

    await this.prisma.user.update({
      where: { uid },
      data: { customerId },
    });

    this.logger.log(`Successfully processed checkout session ${session.id} for user ${uid}`);
  }

  @StripeWebhookHandler('customer.subscription.created')
  async handleSubscriptionCreated(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    this.logger.log(`New subscription created: ${subscription.id}`);

    const checkoutSession = await this.prisma.checkoutSession.findFirst({
      where: { subscriptionId: subscription.id, paymentStatus: 'paid' },
      orderBy: { createdAt: 'desc' },
    });
    if (!checkoutSession) {
      this.logger.error(`No checkout session found for subscription ${subscription.id}`);
      return;
    }
    const { uid } = checkoutSession;

    const { planType, interval } = getSubscriptionInfoFromLookupKey(
      checkoutSession.lookupKey as PriceLookupKey,
    );

    const user = await this.prisma.user.findUnique({ where: { uid } });
    if (!user) {
      this.logger.error(`No user found for uid ${uid}`);
      return;
    }

    const plan = await this.createSubscription(user, {
      planType,
      interval,
      lookupKey: checkoutSession.lookupKey,
      status: subscription.status,
      subscriptionId: subscription.id,
    });

    this.logger.log(`Subscription ${plan.subscriptionId} created for user ${uid}`);
  }

  @StripeWebhookHandler('customer.subscription.updated')
  async handleSubscriptionUpdated(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    this.logger.log(`Subscription updated: ${subscription.id}`);

    // Update user's subscription status if needed
    const sub = await this.prisma.subscription.update({
      where: { subscriptionId: subscription.id },
      data: { status: subscription.status },
    });

    if (sub && sub.status !== 'active') {
      await this.postSubscriptionCanceled(sub);
    }
  }

  async checkTokenUsage(user: User): Promise<ModelTier[]> {
    const { uid } = user;

    let activeMeter = await this.prisma.usageMeter.findFirst({
      where: {
        uid,
        startAt: { lte: new Date() },
        endAt: { gte: new Date() },
        deletedAt: null,
      },
    });

    // Compensate for the case where the usage meter is not found.
    // Typically, the usage meter is automatically resumed with cronjobs, so this should be rare.
    if (!activeMeter) {
      activeMeter = await this.createUsageMeter(user, null, true);
    }

    const availableTiers: ModelTier[] = [];
    if (activeMeter.t1TokenUsed < activeMeter.t1TokenQuota) {
      availableTiers.push('t1');
    }
    if (activeMeter.t2TokenUsed < activeMeter.t2TokenQuota) {
      availableTiers.push('t2');
    }

    return availableTiers;
  }

  async createUsageMeter(user: User, sub?: SubscriptionModel, resumeLastMeter?: boolean) {
    const { uid } = user;
    const planType = sub?.planType || 'free';

    // Find the token quota for the plan
    const tokenQuota = await this.prisma.subscriptionUsageQuota.findUnique({
      where: { planType },
    });

    // Try to find the last usage meter. If we find it, resume from there.
    let startAt: Date;

    if (resumeLastMeter) {
      const lastMeter = await this.prisma.usageMeter.findFirst({
        where: {
          uid,
          deletedAt: null,
        },
        orderBy: {
          startAt: 'desc',
        },
      });
      startAt = lastMeter?.endAt ?? startOfDay(new Date());
    } else {
      startAt = startOfDay(new Date());
    }

    return this.prisma.usageMeter.create({
      data: {
        meterId: genUsageMeterID(),
        uid,
        subscriptionId: sub.subscriptionId,
        startAt,
        endAt: new Date(startAt.getFullYear(), startAt.getMonth() + 1, startAt.getDate()),
        t1TokenQuota: tokenQuota?.t1TokenQuota || 0,
        t1TokenUsed: 0,
        t2TokenQuota: tokenQuota?.t2TokenQuota || 0,
        t2TokenUsed: 0,
      },
    });
  }

  async updateTokenUsage(data: ReportTokenUsageJobData) {
    const { uid, usage, skill, timestamp } = data;

    await this.prisma.$transaction([
      this.prisma.tokenUsage.create({
        data: {
          ...pick(data, ['uid', 'convId', 'jobId', 'spanId']),
          ...pick(usage, ['tier', 'modelProvider', 'modelName', 'inputTokens', 'outputTokens']),
          skillId: skill.skillId,
          skillTplName: skill.tplName,
          skillDisplayName: skill.displayName,
        },
      }),
      this.prisma.usageMeter.updateMany({
        where: {
          uid,
          startAt: { lte: timestamp },
          endAt: { gte: timestamp },
          deletedAt: null,
        },
        data: {
          [usage.tier === 't1' ? 't1TokenUsed' : 't2TokenUsed']: {
            increment: usage.inputTokens + usage.outputTokens,
          },
        },
      }),
    ]);
  }
}

const startOfDay = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};
