/**
 * Install the required dependencies:
 * npm install @tanstack/react-table lucide-react
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnSizingState,
  type HeaderContext,
  type CellContext,
} from '@tanstack/react-table';
import {
  Hash,
  Type,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  MoreHorizontal,
  Plus,
  Pencil,
  CopyPlus,
  Trash2,
  Database,
  RefreshCw,
} from 'lucide-react';

// ============================================================================
// 1. Data Types & Interfaces
// ============================================================================

export interface MovieSearchItem {
  id: string;
  searchTerm: string;
  count: number;
  posterUrl: string;
  movieId: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDataTableProps {
  initialData?: MovieSearchItem[];
  onEditRow?: (item: MovieSearchItem) => void;
  onDuplicateRow?: (item: MovieSearchItem) => void;
  onDeleteRow?: (item: MovieSearchItem) => void;
  onAddColumn?: () => void;
}

// ============================================================================
// 2. Sample Data (At least 15 realistic Movie Search analytics records)
// ============================================================================

export const SAMPLE_MOVIE_SEARCHES: MovieSearchItem[] = [
  {
    id: '67180e3c000ab2f1599a',
    searchTerm: 'Dune: Part Two',
    count: 14285,
    posterUrl: 'https://image.tmdb.org/t/p/w500/8b8Rnx4sd_dune2.jpg',
    movieId: 693134,
    createdAt: '2026-10-22T18:37:00.000Z',
    updatedAt: '2026-10-22T20:15:00.000Z',
  },
  {
    id: '67180dc50034a178bc12',
    searchTerm: 'Oppenheimer',
    count: 12940,
    posterUrl: 'https://image.tmdb.org/t/p/w500/ptpr0kCkr56_oppen.jpg',
    movieId: 872585,
    createdAt: '2026-10-22T17:42:00.000Z',
    updatedAt: '2026-10-22T19:30:00.000Z',
  },
  {
    id: '67180d44001f89bb903e',
    searchTerm: 'Interstellar',
    count: 9840,
    posterUrl: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E_inter.jpg',
    movieId: 157336,
    createdAt: '2026-10-22T16:20:00.000Z',
    updatedAt: '2026-10-22T18:10:00.000Z',
  },
  {
    id: '67180ca2008823cca45f',
    searchTerm: 'Blade Runner 2049',
    count: 8720,
    posterUrl: 'https://image.tmdb.org/t/p/w500/gajva2L0rPY_blade.jpg',
    movieId: 335984,
    createdAt: '2026-10-22T15:10:00.000Z',
    updatedAt: '2026-10-22T17:05:00.000Z',
  },
  {
    id: '67180bf800473a2199b1',
    searchTerm: 'Spider-Man: Across the Spider-Verse',
    count: 8450,
    posterUrl: 'https://image.tmdb.org/t/p/w500/8Vt6mWEReuy_spider.jpg',
    movieId: 569094,
    createdAt: '2026-10-22T14:48:00.000Z',
    updatedAt: '2026-10-22T16:22:00.000Z',
  },
  {
    id: '67180b56001278dd3210',
    searchTerm: 'The Dark Knight',
    count: 7920,
    posterUrl: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDp_batman.jpg',
    movieId: 155,
    createdAt: '2026-10-22T13:30:00.000Z',
    updatedAt: '2026-10-22T15:18:00.000Z',
  },
  {
    id: '67180aa10091aa44ef55',
    searchTerm: 'Inception',
    count: 7610,
    posterUrl: 'https://image.tmdb.org/t/p/w500/oYuLEt3z0_incept.jpg',
    movieId: 27205,
    createdAt: '2026-10-22T12:15:00.000Z',
    updatedAt: '2026-10-22T14:02:00.000Z',
  },
  {
    id: '671809fd003e87bb124a',
    searchTerm: 'Arrival',
    count: 6540,
    posterUrl: 'https://image.tmdb.org/t/p/w500/x2FJsf1El0_arrival.jpg',
    movieId: 329865,
    createdAt: '2026-10-22T11:50:00.000Z',
    updatedAt: '2026-10-22T13:20:00.000Z',
  },
  {
    id: '671809420066d9124419',
    searchTerm: 'Mad Max: Fury Road',
    count: 6180,
    posterUrl: 'https://image.tmdb.org/t/p/w500/hA2ple9qcl_madmax.jpg',
    movieId: 76341,
    createdAt: '2026-10-22T10:40:00.000Z',
    updatedAt: '2026-10-22T12:10:00.000Z',
  },
  {
    id: '671808b00021c43098f2',
    searchTerm: 'Parasite',
    count: 5930,
    posterUrl: 'https://image.tmdb.org/t/p/w500/7IiTTgloJz_parasite.jpg',
    movieId: 496243,
    createdAt: '2026-10-22T09:25:00.000Z',
    updatedAt: '2026-10-22T11:05:00.000Z',
  },
  {
    id: '6718081200fa997811d4',
    searchTerm: 'Everything Everywhere All at Once',
    count: 5410,
    posterUrl: 'https://image.tmdb.org/t/p/w500/w3LxiVYPqM_eeao.jpg',
    movieId: 545611,
    createdAt: '2026-10-22T08:14:00.000Z',
    updatedAt: '2026-10-22T09:45:00.000Z',
  },
  {
    id: '6718077900bba29045ea',
    searchTerm: 'The Matrix',
    count: 5200,
    posterUrl: 'https://image.tmdb.org/t/p/w500/f89U3ADr1oi_matrix.jpg',
    movieId: 603,
    createdAt: '2026-10-22T07:30:00.000Z',
    updatedAt: '2026-10-22T08:50:00.000Z',
  },
  {
    id: '671806e1005511b88e17',
    searchTerm: 'Gladiator',
    count: 4890,
    posterUrl: 'https://image.tmdb.org/t/p/w500/ty8TGRuvJL_glad.jpg',
    movieId: 98,
    createdAt: '2026-10-22T06:12:00.000Z',
    updatedAt: '2026-10-22T07:40:00.000Z',
  },
  {
    id: '671806330089ff012354',
    searchTerm: 'Whiplash',
    count: 4620,
    posterUrl: 'https://image.tmdb.org/t/p/w500/7fn624j5lj_whip.jpg',
    movieId: 244786,
    createdAt: '2026-10-22T05:05:00.000Z',
    updatedAt: '2026-10-22T06:30:00.000Z',
  },
  {
    id: '6718059000dc45aa7890',
    searchTerm: 'The Batman',
    count: 4380,
    posterUrl: 'https://image.tmdb.org/t/p/w500/74xTEgt7R3_batman2.jpg',
    movieId: 414906,
    createdAt: '2026-10-22T04:20:00.000Z',
    updatedAt: '2026-10-22T05:45:00.000Z',
  },
  {
    id: '671804f50011ee9099aa',
    searchTerm: 'Alien: Romulus',
    count: 4190,
    posterUrl: 'https://image.tmdb.org/t/p/w500/b33nnKl1Sp_alien.jpg',
    movieId: 945961,
    createdAt: '2026-10-22T03:10:00.000Z',
    updatedAt: '2026-10-22T04:15:00.000Z',
  },
];

// ============================================================================
// 3. Helper Functions
// ============================================================================

/**
 * Formats ISO date string to exact requested format: "10/22/26, 6:37 PM"
 */
function formatAppwriteDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const year = String(d.getFullYear()).slice(-2);
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${month}/${day}/${year}, ${hours}:${minutes} ${ampm}`;
  } catch {
    return dateStr;
  }
}

const LOCAL_STORAGE_SIZING_KEY = 'appwrite_datatable_column_sizing_v1';

// ============================================================================
// 4. Main Component: AdminDataTable
// ============================================================================

export const AdminDataTable: React.FC<AdminDataTableProps> = ({
  initialData = SAMPLE_MOVIE_SEARCHES,
  onEditRow,
  onDuplicateRow,
  onDeleteRow,
  onAddColumn,
}) => {
  const [data, setData] = useState<MovieSearchItem[]>(initialData);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sorting state: Default $createdAt sorted descending as specified
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ]);

  // Column sizing state with localStorage persistence
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_SIZING_KEY);
        if (saved) return JSON.parse(saved) as ColumnSizingState;
      } catch {
        // Fallback to empty if parse fails
      }
    }
    return {};
  });

  // Persist column sizes whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_SIZING_KEY, JSON.stringify(columnSizing));
    } catch {
      // Ignore quota errors
    }
  }, [columnSizing]);

  // Close row actions dropdown menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(id);
      setCopiedId(id);
      showToast(`Copied ID "${id}" to clipboard`);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  // Base starting sequence number (e.g., 878 descending)
  const baseSequenceStart = 878;

  // ==========================================================================
  // 5. Columns Definition (Memoized, strictly typed without 'any')
  // ==========================================================================
  const columns = useMemo<ColumnDef<MovieSearchItem, unknown>[]>(() => [
    // 1. Row number
    {
      id: 'rowNumber',
      header: () => (
        <span className="text-[#8a8a93] font-mono text-xs select-none">#</span>
      ),
      cell: (info: CellContext<MovieSearchItem, unknown>) => {
        const rowNum = baseSequenceStart - info.row.index;
        return (
          <span className="text-[#8a8a93] font-mono text-xs select-none">
            {rowNum}
          </span>
        );
      },
      size: 60,
      minSize: 50,
      maxSize: 100,
      enableSorting: false,
      enableResizing: true,
    },

    // 2. $id (Chip with copy icon)
    {
      accessorKey: 'id',
      id: 'id',
      header: (info: HeaderContext<MovieSearchItem, unknown>) => (
        <HeaderCellContent
          title="$id"
          icon={<Hash className="w-3.5 h-3.5 text-[#8a8a93]" />}
          info={info}
        />
      ),
      cell: (info: CellContext<MovieSearchItem, unknown>) => {
        const idVal = info.getValue() as string;
        const isCopied = copiedId === idVal;
        return (
          <div className="flex items-center">
            <div
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#25252b] border border-[#33333d] text-neutral-300 font-mono text-xs max-w-full overflow-hidden transition-colors hover:border-[#484856]"
              title={idVal}
            >
              <span className="truncate">{idVal}</span>
              <button
                type="button"
                onClick={(e) => handleCopyId(e, idVal)}
                className="shrink-0 text-[#8a8a93] hover:text-white transition-colors p-0.5"
                title="Copy ID"
              >
                {isCopied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        );
      },
      size: 200,
      minSize: 120,
      maxSize: 350,
      enableResizing: true,
    },

    // 3. searchTerm (Text column, "T" Type icon)
    {
      accessorKey: 'searchTerm',
      id: 'searchTerm',
      header: (info: HeaderContext<MovieSearchItem, unknown>) => (
        <HeaderCellContent
          title="searchTerm"
          icon={<Type className="w-3.5 h-3.5 text-[#8a8a93]" />}
          info={info}
        />
      ),
      cell: (info: CellContext<MovieSearchItem, unknown>) => (
        <span
          className="text-neutral-200 text-[13px] truncate block"
          title={info.getValue() as string}
        >
          {info.getValue() as string}
        </span>
      ),
      size: 200,
      minSize: 100,
      maxSize: 450,
      enableResizing: true,
    },

    // 4. count (Integer column, Hash numeric icon)
    {
      accessorKey: 'count',
      id: 'count',
      header: (info: HeaderContext<MovieSearchItem, unknown>) => (
        <HeaderCellContent
          title="count"
          icon={<Hash className="w-3.5 h-3.5 text-[#8a8a93]" />}
          info={info}
        />
      ),
      cell: (info: CellContext<MovieSearchItem, unknown>) => (
        <span className="text-neutral-200 font-mono text-[13px] block">
          {(info.getValue() as number).toLocaleString()}
        </span>
      ),
      size: 120,
      minSize: 80,
      maxSize: 250,
      enableResizing: true,
    },

    // 5. poster_url (Truncated URL, Type icon)
    {
      accessorKey: 'posterUrl',
      id: 'posterUrl',
      header: (info: HeaderContext<MovieSearchItem, unknown>) => (
        <HeaderCellContent
          title="poster_url"
          icon={<Type className="w-3.5 h-3.5 text-[#8a8a93]" />}
          info={info}
        />
      ),
      cell: (info: CellContext<MovieSearchItem, unknown>) => {
        const url = info.getValue() as string;
        return (
          <span
            className="text-neutral-400 font-mono text-[12px] truncate block hover:text-neutral-200 transition-colors"
            title={url}
          >
            {url}
          </span>
        );
      },
      size: 160,
      minSize: 100,
      maxSize: 400,
      enableResizing: true,
    },

    // 6. movie_id (Integer column, Hash numeric icon)
    {
      accessorKey: 'movieId',
      id: 'movieId',
      header: (info: HeaderContext<MovieSearchItem, unknown>) => (
        <HeaderCellContent
          title="movie_id"
          icon={<Hash className="w-3.5 h-3.5 text-[#8a8a93]" />}
          info={info}
        />
      ),
      cell: (info: CellContext<MovieSearchItem, unknown>) => (
        <span
          className="text-neutral-300 font-mono text-[13px] truncate block"
          title={String(info.getValue())}
        >
          {info.getValue() as number}
        </span>
      ),
      size: 150,
      minSize: 90,
      maxSize: 300,
      enableResizing: true,
    },

    // 7. $createdAt (Date column, Calendar icon)
    {
      accessorKey: 'createdAt',
      id: 'createdAt',
      header: (info: HeaderContext<MovieSearchItem, unknown>) => (
        <HeaderCellContent
          title="$createdAt"
          icon={<Calendar className="w-3.5 h-3.5 text-[#8a8a93]" />}
          info={info}
        />
      ),
      cell: (info: CellContext<MovieSearchItem, unknown>) => (
        <span className="text-neutral-300 text-[13px] whitespace-nowrap block">
          {formatAppwriteDate(info.getValue() as string)}
        </span>
      ),
      size: 200,
      minSize: 140,
      maxSize: 350,
      enableResizing: true,
    },

    // 8. $updatedAt (Date column, Calendar icon)
    {
      accessorKey: 'updatedAt',
      id: 'updatedAt',
      header: (info: HeaderContext<MovieSearchItem, unknown>) => (
        <HeaderCellContent
          title="$updatedAt"
          icon={<Calendar className="w-3.5 h-3.5 text-[#8a8a93]" />}
          info={info}
        />
      ),
      cell: (info: CellContext<MovieSearchItem, unknown>) => (
        <span className="text-neutral-300 text-[13px] whitespace-nowrap block">
          {formatAppwriteDate(info.getValue() as string)}
        </span>
      ),
      size: 200,
      minSize: 140,
      maxSize: 350,
      enableResizing: true,
    },

    // 9. Last column (Add column button in header, row actions dropdown in body)
    {
      id: 'actions',
      header: () => (
        <div className="flex items-center justify-center w-full">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onAddColumn) onAddColumn();
              else showToast('Add column action triggered');
            }}
            className="w-6 h-6 rounded flex items-center justify-center text-[#8a8a93] hover:text-white hover:bg-[#25252b] transition-colors"
            title="Add column"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      ),
      cell: (info: CellContext<MovieSearchItem, unknown>) => {
        const item = info.row.original;
        const isMenuOpen = activeMenuId === item.id;

        return (
          <div className="relative flex items-center justify-center w-full">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuId(isMenuOpen ? null : item.id);
              }}
              className="w-7 h-7 rounded flex items-center justify-center text-[#8a8a93] hover:text-white hover:bg-[#25252b] transition-colors"
              title="Row actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-8 z-50 w-36 py-1 bg-[#1e1e24] border border-[#2d2d33] rounded-md shadow-xl text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-100"
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenuId(null);
                    if (onEditRow) onEditRow(item);
                    else showToast(`Editing "${item.searchTerm}"`);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#282830] hover:text-white text-left transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMenuId(null);
                    if (onDuplicateRow) onDuplicateRow(item);
                    else {
                      const dupItem: MovieSearchItem = {
                        ...item,
                        id: `67180${Math.random().toString(16).slice(2, 17)}`,
                        searchTerm: `${item.searchTerm} (Copy)`,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      };
                      setData((prev) => [dupItem, ...prev]);
                      showToast(`Duplicated "${item.searchTerm}"`);
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#282830] hover:text-white text-left transition-colors"
                >
                  <CopyPlus className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Duplicate</span>
                </button>

                <div className="my-1 border-t border-[#2d2d33]" />

                <button
                  type="button"
                  onClick={() => {
                    setActiveMenuId(null);
                    if (onDeleteRow) onDeleteRow(item);
                    else {
                      setData((prev) => prev.filter((r) => r.id !== item.id));
                      showToast(`Deleted row #${baseSequenceStart - info.row.index}`);
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-left transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        );
      },
      size: 60,
      minSize: 50,
      maxSize: 80,
      enableSorting: false,
      enableResizing: false,
    },
  ], [copiedId, activeMenuId, onEditRow, onDuplicateRow, onDeleteRow, onAddColumn]);

  // ==========================================================================
  // 6. TanStack Table Instance
  // ==========================================================================
  const table = useReactTable<MovieSearchItem>({
    data,
    columns,
    state: {
      sorting,
      columnSizing,
    },
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    defaultColumn: {
      minSize: 60,
      maxSize: 600,
    },
  });

  const resetColumnSizes = () => {
    setColumnSizing({});
    try {
      localStorage.removeItem(LOCAL_STORAGE_SIZING_KEY);
      showToast('Column widths reset to defaults');
    } catch {
      // Ignore
    }
  };

  return (
    <div className="w-full bg-[#000000] text-neutral-200 p-6 flex flex-col gap-4 font-sans antialiased min-h-screen">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[9999] flex items-center gap-2 px-4 py-2 bg-[#0c120e] border border-[#142419] text-white text-xs rounded-md shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-[#142419]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-[#0a110d] border border-[#142419] flex items-center justify-center text-emerald-400">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
              <span>movie_searches</span>
              <span className="text-xs px-2 py-0.5 rounded bg-[#25252b] text-[#8a8a93] font-normal font-mono">
                {data.length} documents
              </span>
            </h1>
            <p className="text-xs text-[#8a8a93]">
              Database Admin View • Drag column borders to resize (persists across reloads)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetColumnSizes}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#222228] border border-[#2d2d33] hover:border-[#444450] text-[#8a8a93] hover:text-white text-xs transition-colors"
            title="Reset column widths"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset widths</span>
          </button>
        </div>
      </div>

      {/* Table Wrapper (Horizontal Scroll Container) */}
      <div className="w-full overflow-x-auto rounded-lg border border-[#2d2d33] bg-[#141417] shadow-xl">
        <table
          className="w-full text-left border-collapse"
          style={{
            tableLayout: 'fixed',
            width: table.getTotalSize(),
            minWidth: '100%',
          }}
        >
          {/* Table Header */}
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="bg-[#1e1e24] border-b border-[#2d2d33] text-[13px] select-none"
              >
                {headerGroup.headers.map((header) => {
                  const isResizing = header.column.getIsResizing();
                  const canSort = header.column.getCanSort();

                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{
                        width: `${header.getSize()}px`,
                      }}
                      className="relative h-[42px] px-4 font-medium text-white border-r border-[#2d2d33] last:border-r-0 group whitespace-nowrap"
                    >
                      {/* Cell Content (Sortable if applicable) */}
                      <div
                        onClick={
                          canSort
                            ? header.column.getToggleSortingHandler()
                            : undefined
                        }
                        className={`flex items-center justify-between w-full h-full ${
                          canSort ? 'cursor-pointer select-none' : ''
                        }`}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </div>

                      {/* Resizer Handle */}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute top-0 right-0 h-full w-[6px] cursor-col-resize select-none touch-none transition-colors z-10 ${
                            isResizing
                              ? 'bg-pink-500 opacity-100'
                              : 'opacity-0 group-hover:opacity-100 hover:bg-neutral-500'
                          }`}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[#2d2d33]">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-32 text-center text-[#8a8a93] text-sm"
                >
                  No documents found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="h-[45px] transition-colors hover:bg-[#1f1f24] group"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{
                        width: `${cell.column.getSize()}px`,
                      }}
                      className="px-4 border-r border-[#2d2d33] last:border-r-0 overflow-hidden text-ellipsis whitespace-nowrap"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-[#8a8a93] px-1">
        <span>Showing {table.getRowModel().rows.length} rows</span>
        <span className="font-mono">table-layout: fixed • @tanstack/react-table v8</span>
      </div>
    </div>
  );
};

// ============================================================================
// 7. Sub-Component: Header Cell Content with Type Icon and Sort Arrows
// ============================================================================

interface HeaderCellContentProps {
  title: string;
  icon: React.ReactNode;
  info: HeaderContext<MovieSearchItem, unknown>;
}

const HeaderCellContent: React.FC<HeaderCellContentProps> = ({
  title,
  icon,
  info,
}) => {
  const isSorted = info.column.getIsSorted(); // 'asc' | 'desc' | false

  return (
    <div className="flex items-center justify-between w-full gap-2">
      {/* Left: Type Icon + Column Name */}
      <div className="flex items-center gap-1.5 overflow-hidden">
        <span className="shrink-0">{icon}</span>
        <span className="text-white font-medium text-[13px] tracking-tight truncate">
          {title}
        </span>
      </div>

      {/* Right: Sort Arrows (Pink/Red when active, Gray when inactive) */}
      <div className="shrink-0 flex items-center pl-1">
        {isSorted === 'desc' ? (
          <ArrowDown className="w-3.5 h-3.5 text-pink-500" />
        ) : isSorted === 'asc' ? (
          <ArrowUp className="w-3.5 h-3.5 text-pink-500" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 text-[#6b7280] group-hover:text-[#9ca3af] transition-colors" />
        )}
      </div>
    </div>
  );
};

export default AdminDataTable;
