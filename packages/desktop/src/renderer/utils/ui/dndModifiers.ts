import type { Modifier } from '@dnd-kit/core';

/** Lock a sortable drag to vertical movement (e.g. sidebar lists). */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});

/** Lock a sortable drag to horizontal movement (e.g. tab bars). */
export const restrictToHorizontalAxis: Modifier = ({ transform }) => ({
  ...transform,
  y: 0,
});
