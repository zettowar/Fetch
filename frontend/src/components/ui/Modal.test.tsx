import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Modal from './Modal';

function Harness({
  onClose,
  dismissible = true,
}: {
  onClose?: () => void;
  dismissible?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button">outside button</button>
      <Modal
        open={open}
        dismissible={dismissible}
        // Deliberately an inline arrow, which is how every caller passes it:
        // its identity changes each render, and the effect must not thrash.
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="Test dialog"
      >
        <button type="button">first</button>
        <button type="button">last</button>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('renders as a labelled modal dialog', () => {
    render(<Harness />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Test dialog');
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape when not dismissible', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} dismissible={false} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps Tab inside the panel', async () => {
    render(<Harness />);
    const dialog = screen.getByRole('dialog');
    const inPanel = Array.from(dialog.querySelectorAll('button'));
    const last = inPanel[inPanel.length - 1];

    last.focus();
    expect(document.activeElement).toBe(last);

    // Tabbing off the last control wraps to the first, rather than escaping to
    // the "outside button" behind the overlay.
    fireEvent.keyDown(document, { key: 'Tab' });
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
    expect(document.activeElement?.textContent).not.toBe('outside button');
  });

  it('locks body scroll while open and restores it on close', async () => {
    render(<Harness />);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(document.body.style.overflow).not.toBe('hidden');
    });
  });

  it('closes when the backdrop is clicked but not the panel', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const dialog = screen.getByRole('dialog');

    fireEvent.mouseDown(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(dialog.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
