import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DogIllustration from './DogIllustration';
import type { DogIllustrationName } from './DogIllustration';

const POSES: DogIllustrationName[] = ['sleeping', 'digging', 'ball', 'sniffing', 'howling'];

describe('DogIllustration', () => {
  it.each(POSES)('renders an svg for the %s pose', (name) => {
    const { container } = render(<DogIllustration name={name} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('becomes a labeled image when given a title', () => {
    const { container } = render(<DogIllustration name="ball" title="Happy pet with ball" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg).toHaveAttribute('aria-label', 'Happy pet with ball');
  });
});
