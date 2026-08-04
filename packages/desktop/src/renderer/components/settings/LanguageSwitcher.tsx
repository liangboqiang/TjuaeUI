import TjuaeSelect from '@/renderer/components/base/TjuaeSelect';
import type { SelectHandle } from '@arco-design/web-react/es/Select/interface';
import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '@/renderer/services/i18n';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const selectRef = useRef<SelectHandle>(null);

  const handleLanguageChange = useCallback((value: string) => {
    // 切换前先 blur 触发元素，避免弹层和语言切换竞争布局
    // Blur before switching to avoid dropdown and language change fighting for layout
    selectRef.current?.blur?.();

    const applyLanguage = () => {
      changeLanguage(value).catch((error: Error) => {
        console.error('Failed to change language:', error);
      });
    };

    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      // 延迟到下一帧执行，确保 DOM 动画已完成 / defer to next frame so DOM animations finish
      window.requestAnimationFrame(() => window.requestAnimationFrame(applyLanguage));
    } else {
      setTimeout(applyLanguage, 0);
    }
  }, []);

  return (
    <div className='flex items-center gap-8px'>
      <TjuaeSelect ref={selectRef} className='w-160px' value={i18n.language} onChange={handleLanguageChange}>
        <TjuaeSelect.Option value='zh-CN'>简体中文</TjuaeSelect.Option>
        <TjuaeSelect.Option value='zh-TW'>繁體中文</TjuaeSelect.Option>
        <TjuaeSelect.Option value='ja-JP'>日本語</TjuaeSelect.Option>
        <TjuaeSelect.Option value='ko-KR'>한국어</TjuaeSelect.Option>
        <TjuaeSelect.Option value='tr-TR'>Türkçe</TjuaeSelect.Option>
        <TjuaeSelect.Option value='ru-RU'>Русский</TjuaeSelect.Option>
        <TjuaeSelect.Option value='uk-UA'>Українська</TjuaeSelect.Option>
        <TjuaeSelect.Option value='pt-BR'>Português (BR)</TjuaeSelect.Option>
        <TjuaeSelect.Option value='de-DE'>Deutsch</TjuaeSelect.Option>
        <TjuaeSelect.Option value='es-ES'>Español</TjuaeSelect.Option>
        <TjuaeSelect.Option value='fr-FR'>Français</TjuaeSelect.Option>
        <TjuaeSelect.Option value='fa-IR'>فارسی</TjuaeSelect.Option>
        <TjuaeSelect.Option value='en-US'>English</TjuaeSelect.Option>
      </TjuaeSelect>
    </div>
  );
};

export default LanguageSwitcher;
