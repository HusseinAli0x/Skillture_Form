import { describe, expect, it } from 'vitest';
import { formatBytes, validateImageFile } from './imageFile';

const file = (name: string, type: string, size: number) => ({ name, type, size });

describe('validateImageFile', () => {
  it('accepts the formats the API accepts', () => {
    expect(validateImageFile(file('a.png', 'image/png', 1000))).toBeNull();
    expect(validateImageFile(file('a.JPG', 'image/jpeg', 1000))).toBeNull();
    expect(validateImageFile(file('a.webp', 'image/webp', 1000))).toBeNull();
    expect(validateImageFile(file('a.gif', 'image/gif', 1000))).toBeNull();
  });

  it('rejects SVG and non-images', () => {
    expect(validateImageFile(file('a.svg', 'image/svg+xml', 1000))).toMatch(/not a supported image/);
    expect(validateImageFile(file('a.pdf', 'application/pdf', 1000))).toMatch(/not a supported image/);
  });

  it('rejects a renamed file whose type disagrees with its extension', () => {
    expect(validateImageFile(file('a.png', 'text/html', 1000))).toMatch(/not a supported image/);
  });

  it('falls back to the extension when the browser reports no type', () => {
    expect(validateImageFile(file('a.png', '', 1000))).toBeNull();
    expect(validateImageFile(file('noext', '', 1000))).toMatch(/not a supported image/);
  });

  it('enforces the size limit and names the size', () => {
    const msg = validateImageFile(file('big.png', 'image/png', 6 * 1024 * 1024));
    expect(msg).toMatch(/6\.0 MB/);
    expect(msg).toMatch(/limit is 5 MB/);
    expect(validateImageFile(file('ok.png', 'image/png', 5 * 1024 * 1024))).toBeNull();
  });

  it('rejects an empty file', () => {
    expect(validateImageFile(file('a.png', 'image/png', 0))).toMatch(/empty/);
  });
});

describe('formatBytes', () => {
  it('scales units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
