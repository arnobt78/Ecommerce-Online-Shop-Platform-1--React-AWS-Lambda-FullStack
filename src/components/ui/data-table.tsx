/**
 * DataTable Component
 *
 * Generic, type-safe sortable table built on @tanstack/react-table (REQ-1611),
 * replacing the hand-rolled SortableTable across every admin list page.
 * Visual output (header/row classes, sort-icon placement) intentionally
 * matches the previous SortableTable 1:1 so no admin page needed a redesign,
 * only a column-definition swap.
 *
 * Usage:
 * const columns: ColumnDef<Product>[] = [
 *   { accessorKey: "name", header: "Name", cell: (info) => <Link ...>{info.getValue()}</Link> },
 *   { id: "actions", header: "Actions", enableSorting: false, cell: (info) => <RowActions row={info.row.original} /> },
 * ];
 * <DataTable data={products} columns={columns} defaultSorting={[{ id: "name", desc: false }]} />
 */

import { useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowData,
} from "@tanstack/react-table";

// Officially-documented TanStack Table v8 extension point — lets column defs
// carry per-column <td>/<th> className overrides (e.g. "whitespace-nowrap")
// the same way the old SortableTable's `className` field did.
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    cellClassName?: string;
    headerClassName?: string;
  }
}

interface DataTableProps<T> {
  data?: T[];
  // Columns intentionally use TanStack Table's own convention of `any` for the
  // per-column value type — each column in one table legitimately has a
  // different TValue (string, number, boolean...), which is exactly what
  // ColumnDef<T, any>[] is designed to express; `never`/`unknown` don't work
  // here since TanStack's own ColumnDef union requires the exact value type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  defaultSorting?: SortingState;
  getRowId?: (row: T, index: number) => string;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  rowClassName?: string;
  // Makes the whole row clickable (e.g. ticket rows navigating to detail);
  // individual cells (like an inline status <select>) can still opt out with
  // their own onClick={(e) => e.stopPropagation()}, same as the old SortableTable.
  onRowClick?: (row: T) => void;
  // Prefetches the row's detail-page query on hover, so the click-through feels
  // instant instead of showing a loading state — see hooks/usePrefetchOnHover.ts.
  onRowHover?: (row: T) => void;
}

export function DataTable<T>({
  data = [],
  columns,
  defaultSorting = [],
  getRowId,
  className = "",
  headerClassName = "",
  bodyClassName = "",
  rowClassName = "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors",
  onRowClick,
  onRowHover,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(defaultSorting);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        <thead className={`bg-gray-50 dark:bg-gray-900 ${headerClassName}`}>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sortDir = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={`px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
                      canSort ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors select-none" : ""
                    } ${header.column.columnDef.meta?.headerClassName || ""}`}
                  >
                    <div className="flex items-center">
                      <span>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</span>
                      {canSort && (
                        <span className={`ml-2 text-xs ${sortDir ? "text-sky-600 dark:text-sky-400" : "text-gray-400 dark:text-gray-500"}`}>
                          {sortDir === "asc" && <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} />}
                          {sortDir === "desc" && <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} />}
                          {!sortDir && <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={2} />}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className={`bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 ${bodyClassName}`}>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={`${rowClassName} ${onRowClick ? "cursor-pointer" : ""}`}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              onMouseEnter={onRowHover ? () => onRowHover(row.original) : undefined}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={`px-4 sm:px-6 py-4 ${cell.column.columnDef.meta?.cellClassName || ""}`}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
