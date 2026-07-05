import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SearchInput from './SearchInput';

describe('SearchInput', () => {
  it('calls onChange with the typed string', () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} placeholder="Search parks" />);
    fireEvent.change(screen.getByPlaceholderText('Search parks'), { target: { value: 'bark' } });
    expect(onChange).toHaveBeenCalledWith('bark');
  });

  it('shows a clear button only when there is a value, and clears on click', () => {
    const onChange = vi.fn();
    const { rerender } = render(<SearchInput value="" onChange={onChange} />);
    expect(screen.queryByLabelText('Clear search')).toBeNull();

    rerender(<SearchInput value="bark" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
