import type { SkillIdentity, SkillSource } from '@/common/types/platform/skill';

export const SKILL_SOURCES: SkillSource[] = ['mine', 'tjuae-hub', 'skillhub', 'clawhub'];

export const sourceTranslationKey: Record<SkillSource, string> = {
  mine: 'settings.skillsHub.spaces.mine',
  'tjuae-hub': 'settings.skillsHub.spaces.tjuaeHub',
  skillhub: 'settings.skillsHub.spaces.skillHub',
  clawhub: 'settings.skillsHub.spaces.clawHub',
};

export const skillRoute = (identity: SkillIdentity): string =>
  `/settings/skills/${encodeURIComponent(identity.source)}/${encodeURIComponent(identity.namespace || '~')}/${encodeURIComponent(identity.slug)}`;

export const compactBytes = (value: number): string => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};
