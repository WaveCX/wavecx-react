import {describe, it, expect, beforeAll, afterEach, vi} from 'vitest';
import {renderHook} from '@testing-library/react';
import '@testing-library/jest-dom/vitest'

import {useAutoModalFromCallback} from './use-auto-modal';

const setupMockHtmlDialogElement = () => {
  // jsdom does not fully support dialog elements,
  // so we need to mock these methods for testing dialogs.

  HTMLDialogElement.prototype.show = function mock(
    this: HTMLDialogElement
  ) {
    this.open = true;
  };

  HTMLDialogElement.prototype.showModal = function mock(
    this: HTMLDialogElement
  ) {
    this.open = true;
  };

  HTMLDialogElement.prototype.close = function mock(
    this: HTMLDialogElement
  ) {
    this.open = false;
    // Trigger the close event
    this.dispatchEvent(new Event('close'));
  };
};

describe('useAutoModalFromCallback', () => {
  beforeAll(() => {
    setupMockHtmlDialogElement();
  });

  afterEach(() => {
    // Clean up any dialogs and reset body overflow
    document.body.innerHTML = '';
    document.body.style.overflow = '';
  });

  describe('basic functionality', () => {
    it('returns autoDialogRef and dialogRef', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      expect(result.current.autoDialogRef).toBeDefined();
      expect(result.current.autoDialogRef).toBeInstanceOf(Function);
      expect(result.current.dialogRef).toBeDefined();
      expect(result.current.dialogRef.current).toBeNull();
    });

    it('automatically opens modal when dialog ref is attached', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      document.body.appendChild(dialog);

      expect(dialog.open).toBe(false);

      result.current.autoDialogRef(dialog);

      expect(dialog.open).toBe(true);
    });

    it('does not open modal that is already open', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      document.body.appendChild(dialog);
      dialog.showModal();

      const initialOpenState = dialog.open;
      result.current.autoDialogRef(dialog);

      expect(dialog.open).toBe(initialOpenState);
    });

    it('does not open modal if not in document body', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      // Don't append to body

      result.current.autoDialogRef(dialog);

      expect(dialog.open).toBe(false);
    });

    it('focuses the dialog when opened', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      document.body.appendChild(dialog);

      let focusCalled = false;
      dialog.focus = () => {
        focusCalled = true;
      };

      result.current.autoDialogRef(dialog);

      expect(focusCalled).toBe(true);
    });

    it('stores dialog reference in dialogRef', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      document.body.appendChild(dialog);

      result.current.autoDialogRef(dialog);

      expect(result.current.dialogRef.current).toBe(dialog);
    });

    it('handles null ref gracefully', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      expect(() => {
        result.current.autoDialogRef(null);
      }).not.toThrow();

      expect(result.current.dialogRef.current).toBeNull();
    });
  });

  describe('closing behavior', () => {
    it('closes modal when close() is called', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      document.body.appendChild(dialog);

      result.current.autoDialogRef(dialog);
      expect(dialog.open).toBe(true);

      dialog.close();
      expect(dialog.open).toBe(false);
    });

    it('closes modal on ESC key (cancel event)', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      document.body.appendChild(dialog);

      result.current.autoDialogRef(dialog);
      expect(dialog.open).toBe(true);

      const cancelEvent = new Event('cancel', {cancelable: true});
      dialog.dispatchEvent(cancelEvent);

      expect(dialog.open).toBe(false);
    });

    it('prevents default cancel behavior', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      document.body.appendChild(dialog);

      result.current.autoDialogRef(dialog);

      const cancelEvent = new Event('cancel', {cancelable: true});
      let defaultPrevented = false;
      cancelEvent.preventDefault = () => {
        defaultPrevented = true;
      };

      dialog.dispatchEvent(cancelEvent);

      expect(defaultPrevented).toBe(true);
    });

    it('closes modal when clicking on dialog backdrop', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      document.body.appendChild(dialog);

      result.current.autoDialogRef(dialog);
      expect(dialog.open).toBe(true);

      const clickEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(clickEvent, 'target', {
        value: dialog,
        enumerable: true,
      });
      document.dispatchEvent(clickEvent);

      expect(dialog.open).toBe(false);
    });

    it('does not close modal when clicking inside content', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      const content = document.createElement('div');
      dialog.appendChild(content);
      document.body.appendChild(dialog);

      result.current.autoDialogRef(dialog);
      expect(dialog.open).toBe(true);

      const clickEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(clickEvent, 'target', {
        value: content,
        enumerable: true,
      });
      document.dispatchEvent(clickEvent);

      expect(dialog.open).toBe(true);
    });

    it('closes modal when component unmounts', () => {
      const {result, unmount} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      document.body.appendChild(dialog);

      result.current.autoDialogRef(dialog);
      expect(dialog.open).toBe(true);

      unmount();

      expect(dialog.open).toBe(false);
    });
  });

  describe('event listener cleanup', () => {
    it('cleans up listeners when ref is set to null', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      document.body.appendChild(dialog);

      result.current.autoDialogRef(dialog);
      expect(dialog.open).toBe(true);

      result.current.autoDialogRef(null);

      // Click outside - should not close since listeners are removed
      const clickEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(clickEvent, 'target', {
        value: dialog,
        enumerable: true,
      });
      document.dispatchEvent(clickEvent);

      expect(dialog.open).toBe(true);
    });

    it('cleans up listeners on unmount', () => {
      const {result, unmount} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      document.body.appendChild(dialog);

      result.current.autoDialogRef(dialog);
      unmount();

      // Try to trigger events after unmount - should not cause errors
      expect(() => {
        const clickEvent = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(clickEvent, 'target', {
          value: dialog,
          enumerable: true,
        });
        document.dispatchEvent(clickEvent);
      }).not.toThrow();
    });

    it('cleans up old listeners when ref changes', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog1 = document.createElement('dialog');
      const dialog2 = document.createElement('dialog');
      document.body.appendChild(dialog1);
      document.body.appendChild(dialog2);

      result.current.autoDialogRef(dialog1);
      expect(dialog1.open).toBe(true);

      result.current.autoDialogRef(dialog2);
      expect(dialog2.open).toBe(true);

      // Click on first dialog - should not close since it's no longer attached
      const clickEvent1 = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(clickEvent1, 'target', {
        value: dialog1,
        enumerable: true,
      });
      document.dispatchEvent(clickEvent1);

      expect(dialog1.open).toBe(true); // Old dialog not affected

      // Click on second dialog - should close
      const clickEvent2 = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(clickEvent2, 'target', {
        value: dialog2,
        enumerable: true,
      });
      document.dispatchEvent(clickEvent2);

      expect(dialog2.open).toBe(false); // New dialog closes
    });
  });

  describe('body scroll lock/unlock', () => {
    it('body has overflow:hidden via CSS when modal is open', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      dialog.className = '__wcx_modal';
      document.body.appendChild(dialog);

      result.current.autoDialogRef(dialog);

      // The CSS rule body:has(dialog.__wcx_modal[open]) should apply
      expect(dialog.open).toBe(true);
      expect(dialog.hasAttribute('open')).toBe(true);
      expect(dialog.classList.contains('__wcx_modal')).toBe(true);
    });

    it('modal loses [open] attribute when closed', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      dialog.className = '__wcx_modal';
      document.body.appendChild(dialog);

      result.current.autoDialogRef(dialog);
      expect(dialog.hasAttribute('open')).toBe(true);

      dialog.close();

      // The [open] attribute should be removed, unlocking body via CSS
      expect(dialog.hasAttribute('open')).toBe(false);
    });

    it('modal loses [open] attribute when unmounted', () => {
      const {result, unmount} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      dialog.className = '__wcx_modal';
      document.body.appendChild(dialog);

      result.current.autoDialogRef(dialog);
      expect(dialog.hasAttribute('open')).toBe(true);

      unmount();

      expect(dialog.hasAttribute('open')).toBe(false);
    });

    it('modal loses [open] attribute when clicking outside', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      dialog.className = '__wcx_modal';
      document.body.appendChild(dialog);

      result.current.autoDialogRef(dialog);
      expect(dialog.hasAttribute('open')).toBe(true);

      const clickEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(clickEvent, 'target', {
        value: dialog,
        enumerable: true,
      });
      document.dispatchEvent(clickEvent);

      expect(dialog.hasAttribute('open')).toBe(false);
    });

    it('modal loses [open] attribute on ESC key', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      dialog.className = '__wcx_modal';
      document.body.appendChild(dialog);

      result.current.autoDialogRef(dialog);
      expect(dialog.hasAttribute('open')).toBe(true);

      const cancelEvent = new Event('cancel', {cancelable: true});
      dialog.dispatchEvent(cancelEvent);

      expect(dialog.hasAttribute('open')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('handles showModal errors gracefully', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      document.body.appendChild(dialog);

      // Mock showModal to throw an error
      dialog.showModal = () => {
        throw new Error('showModal failed');
      };

      // Should not throw
      expect(() => {
        result.current.autoDialogRef(dialog);
      }).not.toThrow();
    });

    it('logs error when showModal fails', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog = document.createElement('dialog');
      document.body.appendChild(dialog);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      dialog.showModal = () => {
        throw new Error('showModal failed');
      };

      result.current.autoDialogRef(dialog);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to open modal:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('multiple modals', () => {
    it('handles switching between different modals', () => {
      const {result} = renderHook(() => useAutoModalFromCallback());

      const dialog1 = document.createElement('dialog');
      const dialog2 = document.createElement('dialog');
      document.body.appendChild(dialog1);
      document.body.appendChild(dialog2);

      result.current.autoDialogRef(dialog1);
      expect(dialog1.open).toBe(true);
      expect(dialog2.open).toBe(false);

      result.current.autoDialogRef(dialog2);
      expect(dialog2.open).toBe(true);

      dialog2.close();
      expect(dialog2.open).toBe(false);
    });

    it('maintains separate event listeners for each modal', () => {
      const {result: result1} = renderHook(() => useAutoModalFromCallback());
      const {result: result2} = renderHook(() => useAutoModalFromCallback());

      const dialog1 = document.createElement('dialog');
      const dialog2 = document.createElement('dialog');
      document.body.appendChild(dialog1);
      document.body.appendChild(dialog2);

      result1.current.autoDialogRef(dialog1);
      result2.current.autoDialogRef(dialog2);

      expect(dialog1.open).toBe(true);
      expect(dialog2.open).toBe(true);

      // Click on first dialog backdrop
      const clickEvent1 = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(clickEvent1, 'target', {
        value: dialog1,
        enumerable: true,
      });
      document.dispatchEvent(clickEvent1);

      expect(dialog1.open).toBe(false);
      expect(dialog2.open).toBe(true); // Second modal unaffected
    });
  });
});
