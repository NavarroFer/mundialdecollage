// A stand-in for the service-role client in payment tests: answers reads
// with `rows[table]` and records every update.
export function fakeSupabase(rows: Record<string, Record<string, unknown> | null>, updateError: { message: string } | null = null) {
  const updates: { table: string; values: Record<string, unknown>; id: unknown }[] = []
  const client = {
    from(table: string) {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: rows[table] ?? null, error: null }) }) }),
        update: (values: Record<string, unknown>) => ({
          eq: async (_column: string, id: unknown) => {
            updates.push({ table, values, id })
            return { error: updateError }
          },
        }),
      }
    },
  }
  return { client, updates }
}
