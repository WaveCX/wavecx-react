import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup();
});

(function mockDialogApi() {
  // jsdom does not implement the native dialog API, so we mock it

  // Specs that opt into the node environment have no DOM to mock
  if (typeof (global as any).HTMLElement === 'undefined') return;

  if (typeof (global as any).HTMLDialogElement === 'undefined') {
    (global as any).HTMLDialogElement = class HTMLDialogElement extends (global as any).HTMLElement {
    };
  }

  const proto = (global as any).HTMLDialogElement.prototype;

  if (!proto.show) {
    proto.show = function() {
      this.setAttribute('open', '');
    };
  }
  if (!proto.showModal) {
    proto.showModal = function() {
      this.setAttribute('open', '');
    };
  }
  if (!proto.close) {
    proto.close = function(returnValue?: string) {
      this.returnValue = returnValue ?? '';
      this.removeAttribute('open');
      // simulate native close event
      this.dispatchEvent(new (global as any).Event('close'));
    };
  }
})();
