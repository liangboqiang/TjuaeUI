
import { Cascader, Message, Tag } from '@arco-design/web-react';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeContext } from '@renderer/hooks/context/ThemeContext';
import { BUILTIN_THEME_GROUPS, BUILTIN_THEMES } from '@renderer/theme/builtinThemes';

const CssThemeSettings: React.FC = () => {
  const { t } = useTranslation();
  const { activeTheme, activeId, selectTheme } = useThemeContext();
  const selectedTheme = activeTheme ?? BUILTIN_THEMES[0];
  const selectedId = activeId && BUILTIN_THEMES.some((item) => item.id === activeId) ? activeId : selectedTheme.id;

  const options = useMemo(
    () => [
      {
        value: 'light',
        label: t('settings.cssTheme.groups.light'),
        children: BUILTIN_THEME_GROUPS.light.map((item) => ({
          value: item.id,
          label: t(item.nameKey),
        })),
      },
      {
        value: 'dark',
        label: t('settings.cssTheme.groups.dark'),
        children: BUILTIN_THEME_GROUPS.dark.map((item) => ({
          value: item.id,
          label: t(item.nameKey),
        })),
      },
    ],
    [t]
  );

  const selectedMeta = BUILTIN_THEMES.find((item) => item.id === selectedId) ?? BUILTIN_THEMES[0];
  const selectedPath = [selectedMeta.appearance, selectedMeta.id];

  const handleChange = useCallback(
    (value: Array<string | string[]>) => {
      const leaf = value.at(-1);
      const themeId = Array.isArray(leaf) ? leaf.at(-1) : leaf;
      const nextTheme = BUILTIN_THEMES.find((item) => item.id === themeId);
      if (!nextTheme || nextTheme.id === selectedId) return;

      void selectTheme(nextTheme.id)
        .then(() => Message.success(t('settings.cssTheme.switchSuccess', { name: t(nextTheme.nameKey) })))
        .catch(() => Message.error(t('settings.cssTheme.switchFailed')));
    },
    [selectTheme, selectedId, t]
  );

  return (
    <div
      className='rounded-12px border border-solid border-border-2 bg-fill-1 px-14px py-13px'
      data-testid='theme-cascader-settings'
    >
      <div className='flex flex-col gap-14px md:flex-row md:items-center md:justify-between md:gap-24px'>
        <div className='min-w-0 flex-1 md:max-w-[520px]'>
          <div className='flex items-center gap-8px'>
            <span className='truncate text-14px font-500 text-t-primary'>{t(selectedMeta.nameKey)}</span>
            <Tag size='small' color={selectedMeta.appearance === 'dark' ? 'gray' : 'arcoblue'}>
              {t(`settings.cssTheme.groups.${selectedMeta.appearance}`)}
            </Tag>
          </div>
          <div className='mt-4px text-12px leading-18px text-t-secondary'>{t(selectedMeta.descriptionKey)}</div>
          <div className='mt-10px flex items-center gap-5px' aria-hidden='true'>
            {selectedMeta.swatches.map((color) => (
              <span
                key={color}
                className='h-18px w-18px rounded-full border border-solid border-border-2 shadow-sm'
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div className='w-full shrink-0 md:w-[280px]'>
          <div className='mb-6px text-12px text-t-secondary'>{t('settings.cssTheme.selectorLabel')}</div>
          <Cascader
            className='w-full'
            data-testid='theme-cascader'
            options={options}
            value={selectedPath}
            expandTrigger='hover'
            showSearch={{ panelMode: 'cascader' }}
            allowClear={false}
            dropdownMenuColumnStyle={{ minWidth: 180 }}
            onChange={handleChange}
            renderFormat={(_, selectedOptions) => {
              const leaf = selectedOptions?.at(-1);
              return typeof leaf?.label === 'string' ? leaf.label : t(selectedMeta.nameKey);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default CssThemeSettings;
