import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CrownMoment, { crownMomentSeen } from './CrownMoment';
import type { WeeklyWinner } from '../types';

const WIN: WeeklyWinner = {
  id: 'w1',
  week_bucket: '2026-11-02',
  species: 'dog',
  pet_id: 'p1',
  pet_name: 'Luna',
  breed: 'Labrador',
  score: 14,
  primary_photo_url: null,
  created_at: '2026-11-09T00:05:00Z',
};

function renderMoment(props: Partial<{ shareable: boolean; onClose: () => void }> = {}) {
  return render(
    <MemoryRouter>
      <CrownMoment winner={WIN} shareable={props.shareable ?? true} onClose={props.onClose ?? (() => {})} />
    </MemoryRouter>,
  );
}

describe('CrownMoment', () => {
  beforeEach(() => localStorage.clear());

  it('names the pet and the crown it won', () => {
    renderMoment();
    expect(screen.getByRole('dialog', { name: 'Luna is Top Dog' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Top Dog rosette' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /share the crown/i })).toBeInTheDocument();
  });

  it('is shown once: closing it marks this win as seen', () => {
    const onClose = vi.fn();
    expect(crownMomentSeen(WIN)).toBe(false);
    renderMoment({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(crownMomentSeen(WIN)).toBe(true);
    // A different week's win is still unseen.
    expect(crownMomentSeen({ ...WIN, week_bucket: '2026-11-09' })).toBe(false);
  });

  it("doesn't offer a share link for a pet whose page isn't public", () => {
    renderMoment({ shareable: false });
    expect(screen.queryByRole('button', { name: /share the crown/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /see luna's profile/i })).toHaveAttribute('href', '/app/pets/p1');
  });
});
