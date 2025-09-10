import { useCallback, useLayoutEffect, useRef } from 'react';

export function useAutoModalFromCallback() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const prevOverflowRef = useRef<string | null>(null);
  const clearCloseListenerRef = useRef<(() => void) | null>(null);
  const clearOutsideClickListenerRef = useRef<(() => void) | null>(null);
  const clearCancelListenerRef = useRef<(() => void) | null>(null);

  const setRef = useCallback((node: HTMLDialogElement | null) => {
    if (!node) {
      return;
    }

    dialogRef.current = node;

    if (!node.open && document.body.contains(node)) {
      try {
        node.showModal();
        node.focus();

        prevOverflowRef.current = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleClose = () => {
          if (prevOverflowRef.current !== null) {
            document.body.style.overflow = prevOverflowRef.current;
            prevOverflowRef.current = null;
          }
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
      const dialog = dialogRef.current;
      if (dialog?.open) {
        dialog.close();
      }

      if (prevOverflowRef.current !== null) {
        document.body.style.overflow = prevOverflowRef.current;
        prevOverflowRef.current = null;
      }
    };
  }, []);

  return {autoDialogRef: setRef, dialogRef};
}
