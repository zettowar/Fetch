import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CatIllustration from './CatIllustration';
import type { IllustrationName } from './PetIllustration';

const POSES: IllustrationName[] = ['sleeping', 'digging', 'ball', 'sniffing', 'howling'];

describe('CatIllustration', () => {
  it.each(POSES)('renders an svg for the %s pose', (name) => {
    const { container } = render(<CatIllustration name={name} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('becomes a labeled image when given a title', () => {
    const { container } = render(<CatIllustration name="ball" title="Happy cat with yarn" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg).toHaveAttribute('aria-label', 'Happy cat with yarn');
  });
});
