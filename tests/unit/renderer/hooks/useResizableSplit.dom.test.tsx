import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useResizableSplit } from '@/renderer/hooks/ui/useResizableSplit';

const VerticalSplitHarness: React.FC<{ storageKey?: string; reverse?: boolean }> = ({
  storageKey,
  reverse = false,
}) => {
  const { splitRatio, dragHandle, createDragHandle } = useResizableSplit({
    axis: 'vertical',
    defaultWidth: 50,
    minWidth: 20,
    maxWidth: 80,
    storageKey,
  });

  return (
    <div data-testid='outer-container'>
      <div>
        <output data-testid='split-ratio'>{splitRatio}</output>
        {reverse ? createDragHandle({ reverse: true }) : dragHandle}
      </div>
    </div>
  );
};

describe('useResizableSplit vertical axis', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses a horizontal drag line and adjusts the split by container height', () => {
    render(<VerticalSplitHarness storageKey='vertical-split' />);

    const outerContainer = screen.getByTestId('outer-container');
    Object.defineProperty(outerContainer, 'offsetHeight', { configurable: true, value: 400 });

    const dragHandle = outerContainer.querySelector('.cursor-row-resize');
    expect(dragHandle).toBeTruthy();

    fireEvent.pointerDown(dragHandle as Element, {
      pointerType: 'mouse',
      pointerId: 1,
      button: 0,
      clientY: 100,
    });
    fireEvent.pointerUp(window, { pointerId: 1, clientY: 180 });

    expect(screen.getByTestId('split-ratio')).toHaveTextContent('70');
    expect(localStorage.getItem('vertical-split')).toBe('70');
  });

  it('ignores an invalid stored height and keeps the default', () => {
    localStorage.setItem('vertical-split', '95');

    render(<VerticalSplitHarness storageKey='vertical-split' />);

    expect(screen.getByTestId('split-ratio')).toHaveTextContent('50');
  });

  it('moves a bottom pane divider down when the reversed handle is dragged down', () => {
    render(<VerticalSplitHarness storageKey='vertical-split' reverse />);

    const outerContainer = screen.getByTestId('outer-container');
    Object.defineProperty(outerContainer, 'offsetHeight', { configurable: true, value: 400 });

    const dragHandle = outerContainer.querySelector('.cursor-row-resize');
    fireEvent.pointerDown(dragHandle as Element, {
      pointerType: 'mouse',
      pointerId: 1,
      button: 0,
      clientY: 100,
    });
    fireEvent.pointerUp(window, { pointerId: 1, clientY: 180 });

    expect(screen.getByTestId('split-ratio')).toHaveTextContent('30');
    expect(localStorage.getItem('vertical-split')).toBe('30');
  });
});
