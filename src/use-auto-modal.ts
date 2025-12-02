import { useCallback, useLayoutEffect, useRef } from 'react';

export function useAutoModalFromCallback() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const clearCloseListenerRef = useRef<(() => void) | null>(null);
  const clearOutsideClickListenerRef = useRef<(() => void) | null>(null);
  const clearCancelListenerRef = useRef<(() => void) | null>(null);

  const setRef = useCallback((node: HTMLDialogElement | null) => {
    // Clean up previous listeners before setting up new ones
    if (clearCloseListenerRef.current) {
      clearCloseListenerRef.current();
      clearCloseListenerRef.current = null;
    }
    if (clearOutsideClickListenerRef.current) {
      clearOutsideClickListenerRef.current();
      clearOutsideClickListenerRef.current = null;
    }
    if (clearCancelListenerRef.current) {
      clearCancelListenerRef.current();
      clearCancelListenerRef.current = null;
    }

    if (!node) {
      return;
    }

    dialogRef.current = node;

    if (!node.open && document.body.contains(node)) {
      try {
        node.showModal();
        node.focus();

        const handleClose = () => {
          if (clearOutsideClickListenerRef.current) {
            clearOutsideClickListenerRef.current();
            clearOutsideClickListenerRef.current = null;
          }
          if (clearCancelListenerRef.current) {
            clearCancelListenerRef.current();
            clearCancelListenerRef.current = null;
          }
        };

        node.addEventListener('close', handleClose);
        clearCloseListenerRef.current = () => {
          node.removeEventListener('close', handleClose);
        };

        const handleOutsideClick = (event: MouseEvent) => {
          if (event.target === node) {
            node.close();
          }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        clearOutsideClickListenerRef.current = () => {
          document.removeEventListener('mousedown', handleOutsideClick);
        };

        const handleCancel = (event: Event) => {
          event.preventDefault();
          node.close();
        };

        node.addEventListener('cancel', handleCancel);
        clearCancelListenerRef.current = () => {
          node.removeEventListener('cancel', handleCancel);
        };
      } catch (err) {
        console.error('Failed to open modal:', err);
      }
    }
  }, []);

  useLayoutEffect(() => {
    return () => {
      // Clean up all event listeners
      if (clearCloseListenerRef.current) {
        clearCloseListenerRef.current();
        clearCloseListenerRef.current = null;
      }
      if (clearOutsideClickListenerRef.current) {
        clearOutsideClickListenerRef.current();
        clearOutsideClickListenerRef.current = null;
      }
      if (clearCancelListenerRef.current) {
        clearCancelListenerRef.current();
        clearCancelListenerRef.current = null;
      }

      // Close dialog if still open
      const dialog = dialogRef.current;
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, []);

  return {autoDialogRef: setRef, dialogRef};
}
