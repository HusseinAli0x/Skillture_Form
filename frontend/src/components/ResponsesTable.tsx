import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  FileText,
  Search,
  X,
} from 'lucide-react';
import client from '../api/client';
import type { FormField, FormResponse } from '../api/types';
import { localized } from '../lib/i18n';
import { exportToCsv, exportToPdf } from '../lib/exportResponses';
import type { ExportColumn, ExportRow } from '../lib/exportResponses';
import { useToastStore } from '../context/ToastStore';
import { Button, IconButton, Input, LoadingState, Select } from './ui';
import ResponsesPdfTemplate from './responses/ResponsesPdfTemplate';

/** Longer than this and the cell truncates, with the full text in a popover. */
const TRUNCATE_AT = 50;

const PAGE_SIZES = [10, 25, 50];

type SortColumn = 'respondent' | 'submitted_at' | string;

/**
 * Answer values arrive as JSONB and have been written by three different
 * versions of the builder: a bare string, a JSON-encoded string, or a
 * localised map. All three collapse to display text here.
 */
const answerText = (value: unknown): string => {
  let candidate: unknown = value;

  if (typeof value === 'string') {
    try {
      const decoded = JSON.parse(value);
      candidate = decoded && typeof decoded === 'object' ? decoded : value;
    } catch {
      return value;
    }
  }

  if (candidate && typeof candidate === 'object') {
    const map = candidate as Record<string, unknown>;
    const text = localized(map as Record<string, string>);
    if (text) return text;
    if (typeof map.name === 'string') return map.name;
    return JSON.stringify(candidate);
  }

  return candidate == null ? '' : String(candidate);
};

interface Props {
  formId: string;
  fields: FormField[];
}

const ResponsesTable: React.FC<Props> = ({ formId, fields }) => {
  const [data, setData] = useState<FormResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const { addToast } = useToastStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchColumn, setSearchColumn] = useState('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('submitted_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(PAGE_SIZES[0]);
  const [popover, setPopover] = useState<{ text: string; x: number; y: number } | null>(null);

  const pdfTemplateRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await client.get<FormResponse[]>(`/api/v1/forms/${formId}/responses/detailed`);
      setData(res.data || []);
    } catch {
      addToast('error', 'Failed to load detailed responses');
    } finally {
      setIsLoading(false);
    }
  }, [formId, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const dismiss = () => setPopover(null);
    window.addEventListener('click', dismiss);
    return () => window.removeEventListener('click', dismiss);
  }, []);

  const columns: ExportColumn[] = useMemo(
    () => fields.map(f => ({ id: f.id, label: localized(f.label, 'Field') })),
    [fields]
  );

  const rows: ExportRow[] = useMemo(
    () =>
      data.map(response => {
        const values: Record<string, string> = {};
        for (const answer of response.answers ?? []) {
          values[answer.field_id] = answerText(answer.value);
        }
        return {
          id: response.id,
          // respondent is {en: "Anonymous"} or {name, email}; localized() picks
          // the first non-empty string either way.
          respondent: localized(response.respondent as Record<string, string>, 'Anonymous'),
          submittedAt: new Date(response.submitted_at),
          values,
        };
      }),
    [data]
  );

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter(row => {
      if (searchColumn === 'respondent') return row.respondent.toLowerCase().includes(query);
      if (searchColumn !== 'all') return (row.values[searchColumn] ?? '').toLowerCase().includes(query);
      return (
        row.respondent.toLowerCase().includes(query) ||
        Object.values(row.values).some(value => value.toLowerCase().includes(query))
      );
    });
  }, [rows, searchQuery, searchColumn]);

  const sortedRows = useMemo(() => {
    const read = (row: ExportRow) =>
      sortColumn === 'respondent'
        ? row.respondent
        : sortColumn === 'submitted_at'
          ? row.submittedAt.getTime()
          : (row.values[sortColumn] ?? '');

    return [...filteredRows].sort((a, b) => {
      const left = read(a);
      const right = read(b);
      if (left < right) return sortDirection === 'asc' ? -1 : 1;
      if (left > right) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / itemsPerPage));

  // Filtering down to fewer pages used to strand the view on an empty page.
  useEffect(() => {
    setCurrentPage(page => Math.min(page, totalPages));
  }, [totalPages]);

  const paginatedRows = sortedRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortIcon = (column: SortColumn) =>
    sortColumn !== column ? null : sortDirection === 'asc' ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );

  // Synchronous now that there is no library to fetch first.
  const handleCsv = () => {
    try {
      exportToCsv(sortedRows, columns);
    } catch {
      addToast('error', 'Failed to generate the spreadsheet');
    }
  };

  const handlePdf = async () => {
    const element = pdfTemplateRef.current;
    if (!element) return;

    setIsExporting(true);
    addToast('info', 'Generating PDF… Please wait');
    try {
      await exportToPdf(element);
      addToast('success', 'PDF downloaded successfully');
    } catch {
      addToast('error', 'Failed to generate PDF');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <LoadingState message="Loading responses…" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-panel p-4 rounded-xl border border-border">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select
            value={searchColumn}
            onChange={e => setSearchColumn(e.target.value)}
            aria-label="Search column"
            className="!w-auto"
          >
            <option value="all">All Columns</option>
            <option value="respondent">Respondent</option>
            {columns.map(column => (
              <option key={column.id} value={column.id}>
                {column.label}
              </option>
            ))}
          </Select>

          <div className="flex-1 sm:w-64">
            <Input
              icon={<Search className="w-4 h-4" />}
              type="search"
              placeholder="Search responses..."
              aria-label="Search responses"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleCsv} title="Opens in Excel">
            <FileText className="w-4 h-4" /> CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={handlePdf} disabled={isExporting}>
            <Download className="w-4 h-4" /> PDF
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-border bg-bg/40 text-muted">
                <th
                  onClick={() => handleSort('respondent')}
                  className="px-5 py-3 font-semibold sticky left-0 bg-panel z-10 cursor-pointer hover:text-text transition-colors border-r border-border"
                >
                  <div className="flex items-center gap-1">Respondent {sortIcon('respondent')}</div>
                </th>
                <th
                  onClick={() => handleSort('submitted_at')}
                  className="px-5 py-3 font-semibold cursor-pointer hover:text-text transition-colors"
                >
                  <div className="flex items-center gap-1">Submitted At {sortIcon('submitted_at')}</div>
                </th>
                {columns.map(column => (
                  <th
                    key={column.id}
                    onClick={() => handleSort(column.id)}
                    className="px-5 py-3 font-semibold cursor-pointer hover:text-text transition-colors max-w-[200px] truncate"
                  >
                    <div className="flex items-center gap-1">
                      {column.label} {sortIcon(column.id)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="px-5 py-10 text-center text-muted">
                    No matching responses found.
                  </td>
                </tr>
              ) : (
                paginatedRows.map(row => (
                  <tr key={row.id} className="group hover:bg-hover-overlay-strong transition-colors">
                    <td className="px-5 py-3 font-medium text-text sticky left-0 bg-panel group-hover:bg-panel-2 z-10 border-r border-border transition-colors">
                      {row.respondent}
                    </td>
                    <td className="px-5 py-3 text-muted">{row.submittedAt.toLocaleString()}</td>
                    {columns.map(column => {
                      const text = row.values[column.id] || '-';
                      const isLong = text.length > TRUNCATE_AT;
                      return (
                        <td
                          key={column.id}
                          className={`px-5 py-3 text-text/80 max-w-[250px] truncate ${
                            isLong ? 'cursor-pointer hover:text-primary' : ''
                          }`}
                          onClick={e => {
                            if (!isLong) return;
                            e.stopPropagation();
                            setPopover({ text, x: e.clientX, y: e.clientY });
                          }}
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-bg/20">
          <div className="flex items-center gap-2">
            <span className="text-muted text-sm">Rows per page:</span>
            <Select
              value={itemsPerPage}
              onChange={e => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              aria-label="Rows per page"
              className="!w-auto !bg-transparent !border-transparent !py-1"
            >
              {PAGE_SIZES.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted">
            <span>
              {sortedRows.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-
              {Math.min(currentPage * itemsPerPage, sortedRows.length)} of {sortedRows.length}
            </span>
            <div className="flex items-center gap-1">
              <IconButton
                label="Previous page"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(page => page - 1)}
              >
                <ChevronLeft className="w-5 h-5" />
              </IconButton>
              <IconButton
                label="Next page"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(page => page + 1)}
              >
                <ChevronRight className="w-5 h-5" />
              </IconButton>
            </div>
          </div>
        </div>
      </div>

      {popover && (
        <div
          role="dialog"
          aria-label="Full answer"
          className="fixed z-[100] bg-panel-2 border border-border rounded-lg shadow-2xl p-4 max-w-sm"
          style={{
            top: Math.min(popover.y + 10, window.innerHeight - 200),
            left: Math.min(popover.x + 10, window.innerWidth - 300),
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-start mb-2 gap-4">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">Full Answer</h4>
            <IconButton label="Close" onClick={() => setPopover(null)} className="!p-0.5">
              <X className="w-4 h-4" />
            </IconButton>
          </div>
          <p className="text-sm text-text leading-relaxed break-words whitespace-pre-wrap">{popover.text}</p>
        </div>
      )}

      <ResponsesPdfTemplate ref={pdfTemplateRef} columns={columns} rows={sortedRows} />
    </div>
  );
};

export default ResponsesTable;
