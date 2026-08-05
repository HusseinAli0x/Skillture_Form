/**
 * Excel and PDF export for the responses table.
 *
 * `xlsx` and `html2pdf.js` are the two heaviest dependencies in the project and
 * each is needed on exactly one admin page, behind a button. Imported
 * statically they landed in the entry chunk and were downloaded by every
 * visitor, including anonymous respondents filling in a public form. The
 * dynamic imports below move them into chunks fetched on first click.
 *
 * Note this does not address the xlsx advisory (CVE-2023-30533) tracked as D2
 * in docs/ISSUES.md — the code is still loaded, just later.
 */

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

export async function exportToExcel(
  rows: ExportRow[],
  columns: ExportColumn[],
  filename = 'Form_Responses.xlsx'
): Promise<void> {
  const XLSX = await import('xlsx');

  const sheetData = rows.map(row => {
    const record: Record<string, string> = {
      Respondent: row.respondent,
      'Submitted At': row.submittedAt.toLocaleString(),
    };
    for (const column of columns) {
      record[column.label] = row.values[column.id] ?? '';
    }
    return record;
  });

  const worksheet = XLSX.utils.json_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Responses');
  XLSX.writeFile(workbook, filename);
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
interface PdfWorkerChain {
  then(onFulfilled: (pdf: any) => void): PdfWorkerChain;
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
