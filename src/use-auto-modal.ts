import { useCallback, useLayoutEffect, useRef } from 'react';

export function useAutoModalFromCallback() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const setRef = useCallback((node: HTMLDialogElement | null) => {
    if (!node) {
      return;
    }

    dialogRef.current = node;

    if (!node.open && document.body.contains(node)) {
      try {
        node.showModal();
        node.focus();
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
    };
  }, []);

  return setRef;
}
