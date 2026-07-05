import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Badge from './Badge';

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>Verified</Badge>);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('applies the variant tint classes', () => {
    render(<Badge variant="success">Active</Badge>);
    expect(screen.getByText('Active')).toHaveClass('bg-success-100');
  });

  it('renders a leading icon slot', () => {
    render(<Badge icon={<span data-testid="badge-icon" />}>Crown</Badge>);
    expect(screen.getByTestId('badge-icon')).toBeInTheDocument();
  });
});
