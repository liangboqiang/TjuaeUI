import { ipcBridge } from '@/common';
import { Button, Input, InputTag, Select, Tag } from '@arco-design/web-react';
import { CloseSmall, Edit, Save, UploadPicture } from '@icon-park/react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './CatalogDetailHero.module.css';

export type CatalogProfileDraft = {
  name: string;
  description: string;
  categories: string[];
  tags: string[];
  imageDataUrl?: string;
};

type Props = {
  identityKey: string;
  glyph: React.ReactNode;
  name: string;
  description: string;
  categories: string[];
  tags: string[];
  sourceLabel: string;
  versionLabel: string;
  version: string;
  versionOptions: Array<{ label: string; value: string }>;
  editable: boolean;
  saving: boolean;
  noDescription: string;
  onVersionChange: (version: string) => void;
  onSave: (draft: CatalogProfileDraft) => Promise<boolean>;
};

const CatalogDetailHero: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(props.name);
  const [description, setDescription] = useState(props.description);
  const [categories, setCategories] = useState(props.categories);
  const [tags, setTags] = useState(props.tags);
  const [imageDataUrl, setImageDataUrl] = useState<string>();

  const reset = () => {
    setName(props.name);
    setDescription(props.description);
    setCategories(props.categories);
    setTags(props.tags);
    setImageDataUrl(undefined);
  };

  useEffect(() => {
    reset();
    setEditing(false);
    // Reset the editor only when the selected catalog item/version changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.identityKey, props.version]);

  const pickImage = async () => {
    const files = await ipcBridge.dialog.showOpen.invoke({
      properties: ['openFile'],
      filters: [{ name: t('settings.assistantAvatarImageFiles'), extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (!files?.[0]) return;
    const dataUrl = await ipcBridge.fs.getImageBase64.invoke({ path: files[0] });
    if (dataUrl) setImageDataUrl(dataUrl);
  };

  const save = async () => {
    if (!name.trim()) return;
    const saved = await props.onSave({
      name: name.trim(),
      description: description.trim(),
      categories,
      tags,
      imageDataUrl,
    });
    if (saved) setEditing(false);
  };

  return (
    <section className={styles.hero}>
      <div className={styles.glyphArea}>
        {imageDataUrl ? <img className={styles.imagePreview} src={imageDataUrl} alt='' /> : props.glyph}
        {editing ? (
          <Button
            className={styles.uploadButton}
            size='mini'
            shape='circle'
            icon={<UploadPicture />}
            aria-label={t('settings.assistantAvatarUploadImage')}
            onClick={() => void pickImage()}
          />
        ) : null}
      </div>
      <div className={styles.identity}>
        <div className={styles.titleRow}>
          {editing ? <Input value={name} maxLength={120} onChange={setName} /> : <h1>{props.name}</h1>}
          <Tag>{props.sourceLabel}</Tag>
          {props.editable ? (
            <div className={styles.editActions}>
              {editing ? (
                <>
                  <Button
                    type='text'
                    shape='circle'
                    icon={<CloseSmall />}
                    aria-label={t('common.cancel')}
                    disabled={props.saving}
                    onClick={() => {
                      reset();
                      setEditing(false);
                    }}
                  />
                  <Button
                    type='primary'
                    shape='circle'
                    icon={<Save />}
                    aria-label={t('common.save')}
                    loading={props.saving}
                    disabled={!name.trim()}
                    onClick={() => void save()}
                  />
                </>
              ) : (
                <Button
                  type='text'
                  shape='circle'
                  icon={<Edit />}
                  aria-label={t('common.edit')}
                  onClick={() => setEditing(true)}
                />
              )}
            </div>
          ) : null}
        </div>
        {editing ? (
          <Input.TextArea
            value={description}
            maxLength={2000}
            autoSize={{ minRows: 2, maxRows: 5 }}
            onChange={setDescription}
          />
        ) : (
          <p>{props.description || props.noDescription}</p>
        )}
        {editing ? (
          <div className={styles.metadataEditor}>
            <label>
              <span>{t('settings.catalogCategories')}</span>
              <InputTag value={categories} allowClear onChange={setCategories} />
            </label>
            <label>
              <span>{t('settings.catalogTags')}</span>
              <InputTag value={tags} allowClear onChange={setTags} />
            </label>
          </div>
        ) : (
          <div className={styles.tags}>
            {props.categories.map((category) => (
              <Tag key={`category:${category}`}>{category}</Tag>
            ))}
            {props.tags.map((tag) => (
              <Tag key={`tag:${tag}`} color='gray'>
                #{tag}
              </Tag>
            ))}
          </div>
        )}
      </div>
      <label className={styles.versionPicker}>
        <span>{props.versionLabel}</span>
        <Select value={props.version} options={props.versionOptions} onChange={props.onVersionChange} />
      </label>
    </section>
  );
};

export default CatalogDetailHero;
