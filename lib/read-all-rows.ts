// Supabase answers at most 1000 rows per request, silently: a query that
// matches 1501 rows returns the first 1000 and no error. /admin/obras read the
// artworks that way and, sorted oldest first, never saw the newest 500 — an
// artist who had just registered could not be found by name. Pass a function
// that builds the query for one slice (`.range(from, to)`), with an ORDER BY
// that is total (end it with the id) so no row is skipped or repeated
// between slices. Throws if any slice fails: a half-read list that looks
// complete is worse than an error.
export const SUPABASE_PAGE_SIZE = 1000

type Slice = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>

export async function readAllRows<T>(slice: (from: number, to: number) => Slice, pageSize = SUPABASE_PAGE_SIZE): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await slice(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as T[]
    rows.push(...batch)
    if (batch.length < pageSize) return rows
  }
}
