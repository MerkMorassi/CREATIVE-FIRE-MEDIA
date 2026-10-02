import React, { useState, useEffect, useRef } from 'react';
import { SearchIcon, MaximizeIcon, CheckIcon } from './icons.tsx';
import { ClipboardIcon } from './icons/ClipboardIcon.tsx';

interface DataframeProps {
  value: {
    data: (string | number | boolean)[][];
    headers: string[];
    metadata?: any;
  };
  datatype?: string[];
  editable?: boolean;
  show_row_numbers?: boolean;
  show_search?: "none" | "search" | "filter" | boolean;
  show_copy_button?: boolean;
  show_fullscreen_button?: boolean;
  label?: string | null;
  show_label?: boolean;
  column_widths?: string[];
  max_height?: number;
  max_chars?: number;
  line_breaks?: boolean;
  wrap?: boolean;
  // React-friendly event handlers
  onChange?: (value: { data: (string | number | boolean)[][]; headers: string[]; metadata?: any }) => void;
  onSelect?: (detail: { index: number[]; value: any; selected: boolean }) => void;
}

export const Dataframe: React.FC<DataframeProps> = ({
  value,
  editable = true,
  show_row_numbers = true,
  show_search = "none",
  show_copy_button = true,
  show_fullscreen_button = true,
  label = null,
  show_label = true,
  column_widths,
  max_height = 500,
  wrap = false,
  onChange,
  onSelect
}) => {
  const [data, setData] = useState<(string | number | boolean)[][]>(value.data || []);
  const [headers, setHeaders] = useState<string[]>(value.headers || []);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingCell, setEditingCell] = useState<{r: number, c: number} | null>(null);
  
  // Sync if prop updates
  useEffect(() => {
      setData(value.data || []);
      setHeaders(value.headers || []);
  }, [value]);

  const filteredData = React.useMemo(() => {
      // Handle "none" string or false boolean for show_search to return full data
      if (!searchTerm || (show_search as any) === "none" || (show_search as any) === false) return data;
      const lowerSearch = searchTerm.toLowerCase();
      return data.filter(row => row.some(cell => String(cell).toLowerCase().includes(lowerSearch)));
  }, [data, searchTerm, show_search]);

  const handleCellChange = (rowIndex: number, colIndex: number, newValue: string) => {
      const newData = [...data];
      newData[rowIndex] = [...newData[rowIndex]];
      newData[rowIndex][colIndex] = newValue;
      setData(newData);
      if (onChange) {
          onChange({ data: newData, headers, metadata: value.metadata });
      }
  };

  const handleCopy = () => {
      const csvContent = [
          headers.join(','),
          ...data.map(row => row.join(','))
      ].join('\n');
      navigator.clipboard.writeText(csvContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const toggleFullscreen = () => {
      setIsFullscreen(!isFullscreen);
  };

  const handleAddRow = () => {
      const newRow = new Array(headers.length).fill('');
      const newData = [...data, newRow];
      setData(newData);
      if (onChange) onChange({ data: newData, headers });
  };

  // Basic styling vars
  const style = {
      '--gr-df-table-bg-even': '#262626', // neutral-800
      '--gr-df-table-bg-odd': '#171717',  // neutral-900
      '--gr-df-table-border': '#404040',  // neutral-700
      '--gr-df-table-text': '#e5e5e5',    // neutral-200
      '--gr-df-accent': '#2563eb',        // blue-600
      '--gr-df-accent-soft': 'rgba(37, 99, 235, 0.2)',
  } as React.CSSProperties;

  return (
    <div 
        className={`flex flex-col border border-neutral-700 rounded-lg overflow-hidden bg-neutral-900 text-sm font-sans relative ${isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : ''}`}
        style={style}
    >
      {/* Header / Toolbar */}
      <div className="flex items-center justify-between p-2 bg-neutral-800 border-b border-neutral-700">
          <div className="flex items-center gap-2">
              {show_label && label && <span className="font-bold text-neutral-300 px-2">{label}</span>}
              {((show_search as any) === 'search' || (show_search as any) === 'filter' || (show_search as any) === true) && (
                  <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Search..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-neutral-900 border border-neutral-700 rounded-md pl-8 pr-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-neutral-200 w-48 transition-all focus:w-64"
                      />
                      <SearchIcon className="w-3 h-3 absolute left-2 top-1.5 text-neutral-500" />
                  </div>
              )}
          </div>
          <div className="flex items-center gap-1">
              {show_copy_button && (
                  <button 
                    onClick={handleCopy} 
                    className="p-1.5 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white transition-colors"
                    title="Copy to Clipboard"
                  >
                      {copied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <ClipboardIcon className="w-4 h-4" />}
                  </button>
              )}
              {show_fullscreen_button && (
                  <button 
                    onClick={toggleFullscreen} 
                    className="p-1.5 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white transition-colors"
                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  >
                      <MaximizeIcon className="w-4 h-4" />
                  </button>
              )}
          </div>
      </div>

      {/* Table Area */}
      <div 
        className="overflow-auto bg-[var(--gr-df-table-bg-odd)] custom-scrollbar"
        style={{ maxHeight: isFullscreen ? 'calc(100vh - 100px)' : max_height }}
      >
          <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-neutral-800 z-10 shadow-sm">
                  <tr>
                      {show_row_numbers && (
                          <th className="p-2 border-b border-r border-[var(--gr-df-table-border)] w-12 text-center text-xs font-mono text-neutral-500">#</th>
                      )}
                      {headers.map((h, i) => (
                          <th 
                            key={i} 
                            className="p-3 border-b border-r border-[var(--gr-df-table-border)] text-xs font-bold text-neutral-300 uppercase tracking-wider last:border-r-0"
                            style={{ width: column_widths?.[i] }}
                          >
                              {h}
                          </th>
                      ))}
                  </tr>
              </thead>
              <tbody>
                  {filteredData.map((row, rIndex) => (
                      <tr 
                        key={rIndex} 
                        className={`group hover:bg-[var(--gr-df-accent-soft)] transition-colors ${rIndex % 2 === 0 ? 'bg-[var(--gr-df-table-bg-even)]' : 'bg-[var(--gr-df-table-bg-odd)]'}`}
                      >
                          {show_row_numbers && (
                              <td className="p-2 border-b border-r border-[var(--gr-df-table-border)] text-center text-xs font-mono text-neutral-500 select-none">
                                  {rIndex + 1}
                              </td>
                          )}
                          {row.map((cell, cIndex) => (
                              <td 
                                key={cIndex}
                                className={`p-0 border-b border-r border-[var(--gr-df-table-border)] last:border-r-0 relative ${wrap ? 'whitespace-normal' : 'whitespace-nowrap'}`}
                                onClick={() => {
                                    if(onSelect) onSelect({ index: [rIndex, cIndex], value: cell, selected: true });
                                    if(editable) setEditingCell({ r: rIndex, c: cIndex });
                                }}
                              >
                                  {editingCell?.r === rIndex && editingCell?.c === cIndex && editable ? (
                                      <input
                                        autoFocus
                                        className="w-full h-full p-3 bg-neutral-900 text-[var(--gr-df-table-text)] outline-none ring-2 ring-[var(--gr-df-accent)] absolute inset-0 z-20"
                                        value={String(cell)}
                                        onChange={(e) => handleCellChange(rIndex, cIndex, e.target.value)}
                                        onBlur={() => setEditingCell(null)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') setEditingCell(null);
                                        }}
                                      />
                                  ) : (
                                      <div className="p-3 w-full h-full min-h-[40px] text-[var(--gr-df-table-text)] cursor-pointer">
                                          {String(cell)}
                                      </div>
                                  )}
                              </td>
                          ))}
                      </tr>
                  ))}
                  {/* Add Row Button Row */}
                  {editable && (
                      <tr>
                          <td colSpan={headers.length + (show_row_numbers ? 1 : 0)} className="p-2 border-t border-[var(--gr-df-table-border)] bg-neutral-800/50">
                              <button 
                                onClick={handleAddRow}
                                className="w-full py-2 border-2 border-dashed border-neutral-600 rounded text-neutral-400 hover:border-[var(--gr-df-accent)] hover:text-[var(--gr-df-accent)] transition-all text-xs font-bold uppercase tracking-wider"
                              >
                                  + Add Row
                              </button>
                          </td>
                      </tr>
                  )}
              </tbody>
          </table>
      </div>
      
      {/* Footer Info */}
      <div className="bg-neutral-800 border-t border-neutral-700 p-2 flex justify-between items-center text-xs text-neutral-500">
          <span>{data.length} rows</span>
          {editable && <span>Double click (or click) cell to edit</span>}
      </div>
    </div>
  );
};
