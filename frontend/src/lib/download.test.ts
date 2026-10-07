import { describe, expect, it } from 'vitest';
import { filenameFromDisposition } from './download';

describe('filenameFromDisposition', () => {
  it('reads a quoted filename', () => {
    expect(filenameFromDisposition('attachment; filename="registrations-intro.csv"', 'x.csv')).toBe('registrations-intro.csv');
  });

  it('reads an unquoted filename', () => {
    expect(filenameFromDisposition('attachment; filename=list.csv', 'x.csv')).toBe('list.csv');
  });

  it('prefers the UTF-8 form and decodes it', () => {
    expect(
      filenameFromDisposition(`attachment; filename="fallback.csv"; filename*=UTF-8''%D9%88%D8%B1%D8%B4%D8%A9.csv`, 'x.csv')
    ).toBe('ورشة.csv');
  });

  it('drops any path and falls back when there is no name', () => {
    expect(filenameFromDisposition('attachment; filename="../../etc/a.csv"', 'x.csv')).toBe('a.csv');
    expect(filenameFromDisposition('attachment', 'x.csv')).toBe('x.csv');
    expect(filenameFromDisposition(undefined, 'x.csv')).toBe('x.csv');
  });
});
