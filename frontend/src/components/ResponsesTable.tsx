import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download, FileText, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import client from '../api/client';
import type { FormField } from '../api/types';
import { useToastStore } from '../context/ToastStore';

interface ResponseAnswer {
  id: string;
  response_id: string;
  field_id: string;
  field_type: number;
  value: any;
}

interface ResponseDetail {
  id: string;
  form_id: string;
  respondent: Record<string, any>;
  status: number;
  submitted_at: string;
  answers: ResponseAnswer[];
}

interface ResponsesTableProps {
  formId: string;
  fields: FormField[];
}

const ResponsesTable: React.FC<ResponsesTableProps> = ({ formId, fields }) => {
  const [data, setData] = useState<ResponseDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addToast } = useToastStore();

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchColumn, setSearchColumn] = useState<string>('all');

  // Sorting State
  const [sortColumn, setSortColumn] = useState<string>('submitted_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Popover State
  const [popover, setPopover] = useState<{ visible: boolean; text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    fetchData();
  }, [formId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await client.get<ResponseDetail[]>(`/api/v1/forms/${formId}/responses/detailed`);
      setData(res.data || []);
    } catch (err) {
      addToast('error', 'Failed to load detailed responses');
    } finally {
      setIsLoading(false);
    }
  };

  // Build row data for easy filtering and sorting
  const rows = useMemo(() => {
    return data.map(resp => {
      const rowData: Record<string, any> = {
        id: resp.id,
        respondent: resp.respondent?.en || resp.respondent?.name || 'Anonymous',
        status: resp.status === 1 ? 'Submitted' : 'Pending',
        submitted_at: new Date(resp.submitted_at),
        _raw: resp,
      };

      // Map answers to field IDs
      if (resp.answers) {
        resp.answers.forEach(ans => {
          let parsedVal = ans.value;
          if (typeof parsedVal === 'string') {
            try {
              const parsed = JSON.parse(parsedVal);
              if (typeof parsed === 'object' && parsed !== null) parsedVal = parsed;
            } catch (e) {
              // Ignore if not valid JSON
            }
          }
          
          if (typeof parsedVal === 'object' && parsedVal !== null) {
            rowData[ans.field_id] = parsedVal.en || parsedVal.ar || parsedVal.name || JSON.stringify(parsedVal);
          } else {
            rowData[ans.field_id] = String(parsedVal);
          }
        });
      }
      return rowData;
    });
  }, [data]);

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows;
    const lowerQuery = searchQuery.toLowerCase();

    return rows.filter(row => {
      if (searchColumn === 'all') {
        return Object.values(row).some(val => 
          val && typeof val === 'string' && val.toLowerCase().includes(lowerQuery)
        );
      } else if (searchColumn === 'respondent') {
        return row.respondent.toLowerCase().includes(lowerQuery);
      } else {
        const cellVal = row[searchColumn];
        return cellVal && typeof cellVal === 'string' && cellVal.toLowerCase().includes(lowerQuery);
      }
    });
  }, [rows, searchQuery, searchColumn]);

  // Sort rows
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];

      if (!valA) valA = '';
      if (!valB) valB = '';

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedRows.length / itemsPerPage);
  const paginatedRows = sortedRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (colId: string) => {
    if (sortColumn === colId) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(colId);
      setSortDirection('asc');
    }
  };

  const handleCellClick = (e: React.MouseEvent, text: string) => {
    if (text.length > 50) {
      setPopover({
        visible: true,
        text,
        x: e.clientX,
        y: e.clientY
      });
    }
  };

  // Close popover when clicking outside
  useEffect(() => {
    const handleClick = () => setPopover(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const exportExcel = () => {
    const exportData = sortedRows.map(row => {
      const obj: any = {
        'Respondent': row.respondent,
        'Submitted At': row.submitted_at.toLocaleString(),
      };
      fields.forEach(f => {
        obj[f.label?.en || 'Field'] = row[f.id] || '';
      });
      return obj;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Responses');
    XLSX.writeFile(workbook, `Form_Responses.xlsx`);
  };

  const exportPDF = () => {
    const element = document.getElementById('pdf-export-container');
    if (!element) return;
    
    addToast('info', 'Generating PDF... Please wait');

    // Move behind the visible content to prevent layout shift and UI freezing
    element.style.display = 'block';
    element.style.position = 'absolute';
    element.style.top = '0';
    element.style.left = '0';
    element.style.zIndex = '-9999';
    element.style.width = '1200px';

    const opt = {
      margin:       [10, 10, 15, 10] as [number, number, number, number],
      filename:     `Form_Responses_Report.pdf`,
      image:        { type: 'jpeg' as 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true, logging: false, windowWidth: 1200 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' as 'landscape' },
      pagebreak:    { mode: 'avoid-all' } // Prevents cutting rows in half
    };

    // Wait a tick to allow the browser to calculate layout and render images
    setTimeout(() => {
      // Chain the worker correctly to avoid double-execution/deadlock
      (html2pdf().set(opt).from(element).toPdf().get('pdf').then((pdf: any) => {
        // Add Footer with page numbers
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(10);
          pdf.setTextColor(100);
          const text = `Page ${i} of ${totalPages}  |  ${new Date().toLocaleDateString()}`;
          const textWidth = pdf.getStringUnitWidth(text) * pdf.internal.getFontSize() / pdf.internal.scaleFactor;
          const textOffset = (pdf.internal.pageSize.width - textWidth) / 2;
          pdf.text(text, textOffset, pdf.internal.pageSize.height - 8);
        }
      }) as any).save().then(() => {
        // Hide again
        element.style.display = 'none';
        element.style.position = 'static';
        element.style.width = 'auto';
        addToast('success', 'PDF Downloaded successfully');
      }).catch(() => {
        element.style.display = 'none';
        element.style.position = 'static';
        element.style.width = 'auto';
        addToast('error', 'Failed to generate PDF');
      });
    }, 200);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#0ABFBC] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#141414] p-4 rounded-xl border border-[#2a2a2a]">
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select 
            value={searchColumn}
            onChange={(e) => setSearchColumn(e.target.value)}
            className="bg-[#1a1a1a] text-sm text-white border border-[#2a2a2a] rounded-lg px-3 py-2 outline-none focus:border-[#0ABFBC] transition-colors"
          >
            <option value="all">All Columns</option>
            <option value="respondent">Respondent</option>
            {fields.map(f => (
              <option key={f.id} value={f.id}>{f.label?.en || 'Field'}</option>
            ))}
          </select>

          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888]" />
            <input 
              type="text" 
              placeholder="Search responses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1a1a1a] text-sm text-white border border-[#2a2a2a] rounded-lg pl-9 pr-3 py-2 outline-none focus:border-[#0ABFBC] transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={exportExcel} className="flex items-center gap-2 bg-[#1f6d43] hover:bg-[#258250] text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            <FileText className="w-4 h-4" /> Excel
          </button>
          <button onClick={exportPDF} className="flex items-center gap-2 bg-[#b33939] hover:bg-[#d63031] text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-xl border border-[#2a2a2a] overflow-hidden bg-[#141414]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-[#2a2a2a] bg-black/40 text-[#888]">
                <th 
                  onClick={() => handleSort('respondent')}
                  className="px-5 py-3 font-semibold sticky left-0 bg-[#141414] z-10 cursor-pointer hover:text-white transition-colors border-r border-[#2a2a2a]"
                >
                  <div className="flex items-center gap-1">Respondent {sortColumn === 'respondent' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                </th>
                <th 
                  onClick={() => handleSort('submitted_at')}
                  className="px-5 py-3 font-semibold cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">Submitted At {sortColumn === 'submitted_at' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                </th>
                {fields.map(f => (
                  <th 
                    key={f.id} 
                    onClick={() => handleSort(f.id)}
                    className="px-5 py-3 font-semibold cursor-pointer hover:text-white transition-colors max-w-[200px] truncate"
                  >
                    <div className="flex items-center gap-1">{f.label?.en || 'Field'} {sortColumn === f.id && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2a]">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={fields.length + 2} className="px-5 py-10 text-center text-[#888]">
                    No matching responses found.
                  </td>
                </tr>
              ) : (
                paginatedRows.map(row => (
                  <tr key={row.id} className="group hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3 font-medium text-[#f0f0f0] sticky left-0 bg-[#141414] group-hover:bg-[#1a1a1a] z-10 border-r border-[#2a2a2a] transition-colors">
                      {row.respondent}
                    </td>
                    <td className="px-5 py-3 text-[#888]">
                      {row.submitted_at.toLocaleString()}
                    </td>
                    {fields.map(f => {
                      const text = row[f.id] || '-';
                      const isLong = text.length > 50;
                      return (
                        <td 
                          key={f.id} 
                          className={`px-5 py-3 text-[#cccccc] max-w-[250px] truncate ${isLong ? 'cursor-pointer hover:text-[#0ABFBC]' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCellClick(e, text);
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

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#2a2a2a] bg-black/20">
          <div className="flex items-center gap-2">
            <span className="text-[#888] text-sm">Rows per page:</span>
            <select 
              value={itemsPerPage} 
              onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-transparent text-sm text-white outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          <div className="flex items-center gap-4 text-sm text-[#888]">
            <span>
              {sortedRows.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-
              {Math.min(currentPage * itemsPerPage, sortedRows.length)} of {sortedRows.length}
            </span>
            <div className="flex items-center gap-1">
              <button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-1 hover:text-white disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                disabled={currentPage === totalPages || totalPages === 0} 
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-1 hover:text-white disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Popover */}
      {popover && popover.visible && (
        <div 
          className="fixed z-[100] bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl p-4 max-w-sm"
          style={{ 
            top: Math.min(popover.y + 10, window.innerHeight - 200), 
            left: Math.min(popover.x + 10, window.innerWidth - 300) 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-start mb-2">
            <h4 className="text-xs font-semibold text-[#888] uppercase tracking-wider">Full Answer</h4>
            <button onClick={() => setPopover(null)} className="text-[#888] hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-white leading-relaxed break-words whitespace-pre-wrap">{popover.text}</p>
        </div>
      )}
      {/* Hidden PDF Template */}
      <div id="pdf-export-container" style={{ display: 'none', padding: '30px', direction: 'rtl', fontFamily: 'sans-serif' }} className="bg-white text-black">
        <div className="flex items-center gap-6 mb-8 border-b-2 pb-6 border-gray-100">
          <img src="/logo.png" alt="Logo" className="h-16 w-auto object-contain" />
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-1" dir="auto">تقرير ردود النموذج</h1>
            <p className="text-sm font-medium text-gray-500" dir="auto">تاريخ الإصدار: {new Date().toLocaleString()}</p>
          </div>
        </div>
        <table className="w-full text-sm text-right text-gray-800 border-collapse">
          <thead className="bg-[#0ABFBC] text-white">
            <tr>
              <th className="border border-[#09aba8] p-3 text-base font-semibold">المُجيب</th>
              <th className="border border-[#09aba8] p-3 text-base font-semibold">وقت التقديم</th>
              {fields.map(f => (
                <th key={f.id} className="border border-[#09aba8] p-3 text-base font-semibold" dir="auto">{f.label?.en || f.label?.ar || 'Field'}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-200 p-3 font-semibold" dir="auto">{row.respondent}</td>
                <td className="border border-gray-200 p-3 text-gray-600" dir="auto">{row.submitted_at.toLocaleString()}</td>
                {fields.map(f => (
                  <td key={f.id} className="border border-gray-200 p-3 max-w-xs break-words" dir="auto">{row[f.id] || '-'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default ResponsesTable;
