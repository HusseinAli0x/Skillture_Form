import React from 'react';
import type { ExportColumn, ExportRow } from '../../lib/exportResponses';

interface Props {
  columns: ExportColumn[];
  rows: ExportRow[];
}

/**
 * Print-only rendering of the responses table, rasterised by exportToPdf.
 *
 * Deliberately light-on-white and RTL rather than themed: it is a printed
 * document, not part of the app's dark UI. It stays hidden until the export
 * runs, which flips it visible for the capture.
 */
const ResponsesPdfTemplate = React.forwardRef<HTMLDivElement, Props>(({ columns, rows }, ref) => (
  <div
    ref={ref}
    style={{ display: 'none', padding: '30px', direction: 'rtl', fontFamily: 'sans-serif' }}
    className="bg-white text-black"
    aria-hidden="true"
  >
    <div className="flex items-center gap-6 mb-8 border-b-2 pb-6 border-gray-100">
      <img src="/logo.png" alt="" className="h-16 w-auto object-contain" />
      <div>
        <h1 className="text-3xl font-bold text-gray-800 mb-1" dir="auto">
          تقرير ردود النموذج
        </h1>
        <p className="text-sm font-medium text-gray-500" dir="auto">
          تاريخ الإصدار: {new Date().toLocaleString()}
        </p>
      </div>
    </div>

    <table className="w-full text-sm text-right text-gray-800 border-collapse">
      <thead className="bg-primary text-white">
        <tr>
          <th className="border border-primary-hover p-3 text-base font-semibold">المُجيب</th>
          <th className="border border-primary-hover p-3 text-base font-semibold">وقت التقديم</th>
          {columns.map(column => (
            <th key={column.id} className="border border-primary-hover p-3 text-base font-semibold" dir="auto">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
            <td className="border border-gray-200 p-3 font-semibold" dir="auto">
              {row.respondent}
            </td>
            <td className="border border-gray-200 p-3 text-gray-600" dir="auto">
              {row.submittedAt.toLocaleString()}
            </td>
            {columns.map(column => (
              <td key={column.id} className="border border-gray-200 p-3 max-w-xs break-words" dir="auto">
                {row.values[column.id] || '-'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
));

ResponsesPdfTemplate.displayName = 'ResponsesPdfTemplate';

export default ResponsesPdfTemplate;
