import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotificationBody from './NotificationBody';

describe('NotificationBody', () => {
  it('signs a donation thank-you with the drawn paw prints', () => {
    render(<NotificationBody type="donation_thanks" body="Your donation to Bayfront Rescue was received." />);
    expect(screen.getByText('Your donation to Bayfront Rescue was received.')).toBeInTheDocument();
    expect(screen.getByTestId('paw-prints')).toBeInTheDocument();
  });

  it('draws the paw prints in place of the emoji on older rows', () => {
    render(<NotificationBody type="donation_thanks" body="Your donation to Bayfront Rescue was received. 🐾" />);
    expect(screen.getByText('Your donation to Bayfront Rescue was received.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('🐾');
    expect(screen.getByTestId('paw-prints')).toBeInTheDocument();
  });

  it('leaves other kinds alone, including any emoji a person typed', () => {
    render(<NotificationBody type="comment" body="so cute 🐾" />);
    expect(screen.getByText('so cute 🐾')).toBeInTheDocument();
    expect(screen.queryByTestId('paw-prints')).toBeNull();
  });
});
