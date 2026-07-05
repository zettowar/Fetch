import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BoneProgress from './BoneProgress';

describe('BoneProgress', () => {
  it('exposes progressbar semantics', () => {
    render(<BoneProgress value={3} max={10} label="3 of 10 daily swipes remaining" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '10');
    expect(bar).toHaveAccessibleName('3 of 10 daily swipes remaining');
  });

  it.each([
    [0, 'bg-danger-400'],
    [2, 'bg-warning-400'],
    [8, 'bg-brand-500'],
  ])('at %s/10 the fill uses %s', (value, cls) => {
    const { container } = render(<BoneProgress value={value} max={10} />);
    expect(container.querySelector(`.${cls}`)).not.toBeNull();
  });
});
