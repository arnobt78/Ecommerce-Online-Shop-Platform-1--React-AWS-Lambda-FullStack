// Parent: REQ-1662 — thin wrapper around the well-tested `csv-parse`/
// `csv-stringify` packages (RFC4180 quoting/escaping is easy to get subtly
// wrong by hand — e.g. a product description containing a comma or a
// newline — so this reuses a maintained library rather than reinventing it).

import { stringify } from "csv-stringify/sync";
import { parse } from "csv-parse/sync";

export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  return stringify(rows, { header: true, columns });
}

// Returns every row as Record<string, string> (raw text — callers coerce
// types themselves via their own Zod schema, same as any other route input).
export function fromCsv(csvText: string): Array<Record<string, string>> {
  return parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
}
