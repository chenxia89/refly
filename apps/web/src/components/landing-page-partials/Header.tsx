import Logo from '@/assets/logo.svg';
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuthStoreShallow } from '@refly-packages/ai-workspace-common/stores/auth';
import { UILocaleList } from '@refly-packages/ai-workspace-common/components/ui-locale-list';
import { IconDown, IconLanguage } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from '@refly-packages/ai-workspace-common/utils/router';
import './header.scss';
import { FaDiscord, FaGithub } from 'react-icons/fa6';

function Header() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const location = useLocation();
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));

  const [value, setValue] = useState('product');
  const [starCount, setStarCount] = useState('614');

  const tabOptions = [
    {
      label: t('landingPage.tab.product'),
      value: 'product',
    },
    {
      label: t('landingPage.tab.price'),
      value: 'pricing',
    },
    {
      label: t('landingPage.tab.docs'),
      value: 'docs',
    },
    {
      label: (
        <div
          className="flex cursor-pointer items-center gap-1"
          onClick={() => window.open('https://discord.gg/bWjffrb89h', '_blank')}
        >
          <FaDiscord />
          {t('landingPage.tab.discord')}
        </div>
      ),
      value: 'discord',
    },
  ];

  useEffect(() => {
    setValue(location.pathname.split('/')[1] || 'product');
  }, [location.pathname]);

  useEffect(() => {
    // Fetch GitHub star count
    fetch('https://api.github.com/repos/refly-ai/refly')
      .then((res) => res.json())
      .then((data) => {
        const stars = data.stargazers_count;
        setStarCount(stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars.toString());
      })
      .catch(() => {
        // Keep default value if fetch fails
      });
  }, []);

  return (
    <div className="fixed top-0 z-20 flex w-full !justify-center px-6 backdrop-blur-lg sm:px-6 md:px-6 lg:px-0">
      <div className="relative flex max-w-7xl items-center justify-between py-4 md:w-[65%]">
        <div className="mr-4 flex shrink-0 flex-row items-center" style={{ height: 45 }}>
          <div
            className="flex h-full cursor-pointer flex-row items-center"
            onClick={() => navigate('/')}
          >
            <img src={Logo} className="w-[35px]" alt="Refly Logo" />
            <span className="ml-2 text-base font-bold">Refly</span>
          </div>
          <div className="ml-4 flex flex-row items-center">
            {tabOptions.map((item) => (
              <Button
                type="text"
                key={item.value}
                className={`${value === item.value ? 'font-bold text-[#00968f]' : ''}`}
                onClick={() => {
                  switch (item.value) {
                    case 'product':
                      navigate('/');
                      break;
                    case 'pricing':
                      navigate('/pricing');
                      break;
                    case 'docs':
                      window.open('https://docs.refly.ai', '_blank');
                      break;
                    case 'discord':
                      window.open('https://discord.gg/bWjffrb89h', '_blank');
                      break;
                  }
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <UILocaleList>
            <Button type="text" size="middle" className="px-2 text-gray-600 hover:text-[#00968f]">
              <IconLanguage className="h-4 w-4" />
              {t('language')}{' '}
              <IconDown className="ml-1 transition-transform duration-200 group-hover:rotate-180" />
            </Button>
          </UILocaleList>

          <Button
            type="text"
            size="middle"
            icon={<FaGithub className="h-4 w-4" />}
            onClick={() => window.open('https://github.com/refly-ai/refly', '_blank')}
            className="flex items-center gap-1 px-2 text-gray-600 hover:text-[#00968f]"
          >
            {starCount}
          </Button>

          <Button type="primary" onClick={() => setLoginModalOpen(true)}>
            {t('landingPage.tryForFree')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Header;
