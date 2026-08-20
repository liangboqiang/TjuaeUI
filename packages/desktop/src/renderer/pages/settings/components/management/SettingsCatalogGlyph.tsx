import React, { useEffect, useState } from 'react';
import styles from './SettingsCatalogCard.module.css';

type SettingsCatalogGlyphProps = {
  imageUrl?: string;
  fallback: string;
  large?: boolean;
};

/** 目录卡片与详情页共用的图像加载、失败回退与尺寸规则。 */
const SettingsCatalogGlyph: React.FC<SettingsCatalogGlyphProps> = ({ imageUrl, fallback, large = false }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageUrl]);
  const className = large ? styles.glyphLarge : styles.glyph;

  return imageUrl && !failed ? (
    <img className={className} src={imageUrl} alt='' loading='lazy' decoding='async' onError={() => setFailed(true)} />
  ) : (
    <span className={className} aria-hidden='true'>
      {fallback}
    </span>
  );
};

export default SettingsCatalogGlyph;
