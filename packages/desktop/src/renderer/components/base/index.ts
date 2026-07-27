/**
 * @license
 * Copyright 2026 Tjuae
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * TjuaeUI 基础组件库统一导出 / TjuaeUI base components unified exports
 *
 * 提供所有基础组件和类型的统一导出入口
 * Provides unified export entry for all base components and types
 */

// ==================== 组件导出 / Component Exports ====================

export { default as TjuaeModal } from './TjuaeModal';
export { default as TjuaeCollapse } from './TjuaeCollapse';
export { default as TjuaeSelect } from './TjuaeSelect';
export { default as TjuaeScrollArea } from './TjuaeScrollArea';
export { default as TjuaeSteps } from './TjuaeSteps';
export { default as TjuaeSearchInput } from './TjuaeSearchInput';
export { default as TjuaeInlineSearchInput } from './TjuaeInlineSearchInput';

// ==================== 类型导出 / Type Exports ====================

// TjuaeModal 类型 / TjuaeModal types
export type {
  ModalSize,
  ModalHeaderConfig,
  ModalFooterConfig,
  ModalContentStyleConfig,
  TjuaeModalProps,
} from './TjuaeModal';
export { MODAL_SIZES } from './TjuaeModal';

// TjuaeCollapse 类型 / TjuaeCollapse types
export type { TjuaeCollapseProps, TjuaeCollapseItemProps } from './TjuaeCollapse';

// TjuaeSelect 类型 / TjuaeSelect types
export type { TjuaeSelectProps } from './TjuaeSelect';

// TjuaeSteps 类型 / TjuaeSteps types
export type { TjuaeStepsProps } from './TjuaeSteps';

// TjuaeSearchInput 类型 / TjuaeSearchInput types
export type { TjuaeSearchInputProps } from './TjuaeSearchInput';

// TjuaeInlineSearchInput 类型 / TjuaeInlineSearchInput types
export type { TjuaeInlineSearchInputProps } from './TjuaeInlineSearchInput';
