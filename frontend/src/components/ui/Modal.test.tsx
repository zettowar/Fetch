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

  /** The Modal focuses its first control on open via requestAnimationFrame.
   *  Asserting before that lands makes a trap test pass on the autofocus
   *  instead of on the trap — which is exactly how the first version of these
   *  tests passed against a broken trap. */
  async function settleAutofocus(dialog: HTMLElement) {
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  }

  it('wraps Tab forwards at the end of the panel', async () => {
    render(<Harness />);
    const dialog = screen.getByRole('dialog');
    await settleAutofocus(dialog);

    const inPanel = Array.from(dialog.querySelectorAll('button'));
    const first = inPanel[0];
    const last = inPanel[inPanel.length - 1];

    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('wraps Tab backwards at the start of the panel', async () => {
    render(<Harness />);
    const dialog = screen.getByRole('dialog');
    await settleAutofocus(dialog);

    const inPanel = Array.from(dialog.querySelectorAll('button'));
    const first = inPanel[0];
    const last = inPanel[inPanel.length - 1];

    first.focus();
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('pulls focus back when it is outside the panel', async () => {
    // The case the original trap missed: a forward Tab while focus sat on the
    // page behind walked into that page instead of back into the dialog.
    render(<Harness />);
    const dialog = screen.getByRole('dialog');
    await settleAutofocus(dialog);

    const outside = screen.getByRole('button', { name: 'outside button' });
    const first = dialog.querySelectorAll('button')[0] as HTMLElement;

    outside.focus();
    expect(document.activeElement).toBe(outside);

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
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
