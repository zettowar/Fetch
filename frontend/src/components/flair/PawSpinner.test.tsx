import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PawSpinner from './PawSpinner';

describe('PawSpinner', () => {
  it('exposes the same a11y contract as the old Spinner', () => {
    render(<PawSpinner />);
    const status = screen.getByRole('status');
    expect(status).toHaveAccessibleName('Loading');
  });

  it('accepts a custom label', () => {
    render(<PawSpinner label="Fetching dogs" />);
    expect(screen.getByRole('status')).toHaveAccessibleName('Fetching dogs');
  });
});
