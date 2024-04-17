import { create } from "zustand"
import { devtools } from "zustand/middleware"
import type {} from "@redux-devtools/extension"
import type { Conversation } from "@/types"
import { ConversationOperation } from "@/types"

interface ConversationState {
  // state
  currentConversation: Conversation | null
  conversationList: Conversation[]

  // method
  setConversationList: (conversationList: Conversation[]) => void
  setCurrentConversation: (val: Conversation) => void
  updateConversation: (
    operationType: ConversationOperation,
    payload: Partial<Conversation>,
  ) => void
  resetState: () => void
}

const defaultState = {
  currentConversation: null,
  conversationList: [],
}

export const useConversationStore = create<ConversationState>()(
  devtools(set => ({
    ...defaultState,

    setConversationList: (val: Conversation[]) =>
      set({ conversationList: val }),
    setCurrentConversation: (val: Conversation) =>
      set({ currentConversation: val }),
    updateConversation: (
      operationType: ConversationOperation,
      payload: Partial<Conversation>,
    ) =>
      set(state => {
        const conversationList = state.conversationList
        let newConversationList = conversationList

        switch (operationType) {
          case ConversationOperation.CREATE: {
            const { title = "新会话", origin, originPageTitle } = payload
            const newConversation = {
              title: title ?? "新会话",
              origin,
              originPageTitle,
              createdAt: new Date().getTime() as number,
              updatedAt: new Date().getTime() as number,
              readEnhanceArticle: null,
              readEnhanceIndexStatus: null,
            } as Conversation

            newConversationList = [newConversation].concat(conversationList)

            break
          }

          case ConversationOperation.DELETE: {
            const { conversationId } = payload
            const newConversationList = conversationList.filter(
              item => item.id !== conversationId,
            )

            break
          }

          case ConversationOperation.UPDATE: {
            const { conversationId } = payload
            const newConversationList = conversationList.map(item => {
              if (item.id === conversationId) {
                return { ...item, ...payload }
              }

              return item
            })

            break
          }
        }

        return {
          ...state,
          conversationList: newConversationList,
        }
      }),
    resetState: () => set(state => ({ ...state, ...defaultState })),
  })),
)
