import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { usePawBurst } from './PawBurst';

let reducedMotion = false;
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => reducedMotion };
});

function Harness() {
  const { fire, PawBurstLayer } = usePawBurst();
  const fireRef = useRef(fire);
  fireRef.current = fire;
  return (
    <div className="relative">
      <PawBurstLayer />
      <button onClick={() => fireRef.current({ count: 6 })}>fire</button>
    </div>
  );
}

afterEach(() => {
  reducedMotion = false;
});

describe('usePawBurst', () => {
  it('renders particles after fire()', () => {
    const { getByText, container } = render(<Harness />);
    act(() => {
      getByText('fire').click();
    });
    expect(container.querySelectorAll('svg').length).toBe(6);
  });

  it('is a no-op under reduced motion', () => {
    reducedMotion = true;
    const { getByText, container } = render(<Harness />);
    act(() => {
      getByText('fire').click();
    });
    expect(container.querySelectorAll('svg').length).toBe(0);
  });
});
