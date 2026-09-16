import {describe, it, expect} from 'vitest';
import {withContentCapabilities} from './content-messages';

describe('withContentCapabilities', () => {
  it('adds the capabilities as the first query param', () => {
    expect(withContentCapabilities('https://acme.wavecx.com/targeted-content/abc'))
      .toBe('https://acme.wavecx.com/targeted-content/abc?wcxCapabilities=dismiss-content');
  });

  it('appends to an existing query string', () => {
    expect(withContentCapabilities('https://acme.wavecx.com/targeted-content/abc?messageLinks=true'))
      .toBe('https://acme.wavecx.com/targeted-content/abc?messageLinks=true&wcxCapabilities=dismiss-content');
    expect(withContentCapabilities('https://acme.wavecx.com/targeted-content/abc?'))
      .toBe('https://acme.wavecx.com/targeted-content/abc?wcxCapabilities=dismiss-content');
  });

  it('keeps a fragment after the query string', () => {
    expect(withContentCapabilities('https://acme.wavecx.com/targeted-content/abc#slide-2'))
      .toBe('https://acme.wavecx.com/targeted-content/abc?wcxCapabilities=dismiss-content#slide-2');
  });

  it('leaves non-http URLs untouched', () => {
    const mockContentUrl = 'data:text/html,<p>mock</p>';
    expect(withContentCapabilities(mockContentUrl)).toBe(mockContentUrl);
  });
});
