/**
 * Spreadsheet and PDF export for the responses table.
 *
 * `html2pdf.js` is the heaviest dependency in the project and is needed on this
 * one admin page, behind a button. Imported statically it landed in the entry
 * chunk and was downloaded by every visitor, including anonymous respondents
 * filling in a public form, so it is a dynamic import fetched on first click.
 *
 * The spreadsheet export used to go through `xlsx`, which carried
 * CVE-2023-30533 and a ReDoS advisory with no fixed version on npm (D2). It
 * wrote a single flat sheet of strings, which CSV does with no dependency at
 * all — see lib/csv.ts.
 */

import { downloadCsv, toCsv } from './csv';

export interface ExportColumn {
  id: string;
  label: string;
}

export interface ExportRow {
  id: string;
  respondent: string;
  submittedAt: Date;
  /** Answer text keyed by field id. */
  values: Record<string, string>;
}

/** Writes the responses as a CSV file, which opens in Excel on double-click. */
export function exportToCsv(
  rows: ExportRow[],
  columns: ExportColumn[],
  filename = 'Form_Responses.csv'
): void {
  const header = ['Respondent', 'Submitted At', ...columns.map(column => column.label)];

  const body = rows.map(row => [
    row.respondent,
    row.submittedAt.toLocaleString(),
    ...columns.map(column => row.values[column.id] ?? ''),
  ]);

  downloadCsv(filename, toCsv(header, body));
}

/**
 * Renders `element` to a PDF.
 *
 * The element is a print-only template kept hidden in the DOM. html2canvas
 * cannot rasterise `display: none`, so it is briefly shown behind the page at a
 * fixed width and restored afterwards — including when rendering throws, which
 * previously could leave the template visible over the app.
 */
/**
 * The types bundled with html2pdf.js are incomplete: `pagebreak` is a real
 * option but absent from Html2PdfOptions, and `.get()` is declared as a plain
 * Promise when at runtime the worker's `.then()` returns the worker itself, so
 * the chain continues into `.save()`. Neither interface is exported, so the
 * shape used here is declared locally rather than papered over with `any`.
 */
/** The slice of the jsPDF document the page footer below actually touches. */
interface JsPdfDoc {
  internal: {
    getNumberOfPages(): number;
    getFontSize(): number;
    scaleFactor: number;
    pageSize: { width: number; height: number };
  };
  setPage(page: number): void;
  setFontSize(size: number): void;
  setTextColor(grey: number): void;
  getStringUnitWidth(text: string): number;
  text(text: string, x: number, y: number): void;
}

interface PdfWorkerChain {
  then(onFulfilled: (pdf: JsPdfDoc) => void): PdfWorkerChain;
  save(): Promise<void>;
}

export async function exportToPdf(
  element: HTMLElement,
  filename = 'Form_Responses_Report.pdf'
): Promise<void> {
  const { default: html2pdf } = await import('html2pdf.js');

  const previous = element.getAttribute('style') ?? '';
  Object.assign(element.style, {
    display: 'block',
    position: 'absolute',
    top: '0',
    left: '0',
    zIndex: '-9999',
    width: '1200px',
  });

  try {
    // One frame for the browser to lay the template out before it is captured.
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));

    const options = {
      margin: [10, 10, 15, 10] as [number, number, number, number],
      filename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: 1200 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const },
      // Keeps a table row from being sliced across a page boundary.
      pagebreak: { mode: 'avoid-all' },
    };

    const pdfChain = html2pdf()
      .set(options)
      .from(element)
      .toPdf()
      .get('pdf') as unknown as PdfWorkerChain;

    await pdfChain
      .then(pdf => {
        const pageCount = pdf.internal.getNumberOfPages();
        for (let page = 1; page <= pageCount; page++) {
          pdf.setPage(page);
          pdf.setFontSize(10);
          pdf.setTextColor(100);
          const text = `Page ${page} of ${pageCount}  |  ${new Date().toLocaleDateString()}`;
          const textWidth =
            (pdf.getStringUnitWidth(text) * pdf.internal.getFontSize()) / pdf.internal.scaleFactor;
          pdf.text(text, (pdf.internal.pageSize.width - textWidth) / 2, pdf.internal.pageSize.height - 8);
        }
      })
      .save();
  } finally {
    element.setAttribute('style', previous);
  }
}
