// In-memory Supabase mock — supports the query patterns used by decision helpers

type Row = Record<string, unknown>;

class QueryBuilder {
  private _table: string;
  private _store: Map<string, Row[]>;
  private _filters: Array<(row: Row) => boolean> = [];
  private _limit?: number;
  private _order?: { col: string; asc: boolean };
  private _selectCols?: string;
  private _insertData?: Row | Row[];
  private _updateData?: Row;
  private _upsertData?: Row | Row[];
  private _upsertConflict?: string;
  private _single = false;
  private _op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';

  constructor(table: string, store: Map<string, Row[]>) {
    this._table = table;
    this._store = store;
    if (!this._store.has(table)) this._store.set(table, []);
  }

  select(cols?: string) {
    this._selectCols = cols;
    // Don't override op for write operations — select just marks which columns to return
    if (!['insert', 'update', 'upsert', 'delete'].includes(this._op)) {
      this._op = 'select';
    }
    return this;
  }
  insert(data: Row | Row[]) { this._insertData = data; this._op = 'insert'; return this; }
  update(data: Row) { this._updateData = data; this._op = 'update'; return this; }
  upsert(data: Row | Row[], opts?: { onConflict?: string }) {
    this._upsertData = data; this._upsertConflict = opts?.onConflict; this._op = 'upsert'; return this;
  }
  delete() { this._op = 'delete'; return this; }

  eq(col: string, val: unknown) { this._filters.push((r) => r[col] === val); return this; }
  neq(col: string, val: unknown) { this._filters.push((r) => r[col] !== val); return this; }
  in(col: string, vals: unknown[]) { this._filters.push((r) => vals.includes(r[col])); return this; }
  lt(col: string, val: unknown) { this._filters.push((r) => (r[col] as string) < (val as string)); return this; }
  lte(col: string, val: unknown) { this._filters.push((r) => (r[col] as string) <= (val as string)); return this; }
  gte(col: string, val: unknown) { this._filters.push((r) => (r[col] as string) >= (val as string)); return this; }
  is(col: string, val: unknown) {
    this._filters.push((r) => val === null ? r[col] == null : r[col] === val); return this;
  }
  not(col: string, op: string, val: unknown) {
    if (op === 'is') this._filters.push((r) => r[col] != val);
    if (op === 'in') this._filters.push((r) => !(val as unknown[]).includes(r[col]));
    return this;
  }
  limit(n: number) { this._limit = n; return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this._order = { col, asc: opts?.ascending !== false }; return this;
  }
  single() { this._single = true; return this; }

  async then(resolve: (v: { data: unknown; error: null | { message: string } }) => void) {
    resolve(await this._execute());
  }

  private async _execute(): Promise<{ data: unknown; error: null | { message: string } }> {
    const rows = this._store.get(this._table)!;

    if (this._op === 'insert') {
      const toInsert = Array.isArray(this._insertData) ? this._insertData : [this._insertData!];
      const inserted = toInsert.map((r) => ({
        id: r.id ?? crypto.randomUUID(),
        created_at: r.created_at ?? new Date().toISOString(),
        updated_at: r.updated_at ?? new Date().toISOString(),
        ...r,
      }));
      rows.push(...inserted);
      if (this._single) return { data: inserted[0], error: null };
      return { data: inserted, error: null };
    }

    if (this._op === 'upsert') {
      const toUpsert = Array.isArray(this._upsertData) ? this._upsertData : [this._upsertData!];
      const conflict = this._upsertConflict ?? 'id';
      for (const item of toUpsert) {
        const idx = rows.findIndex((r) => r[conflict] === item[conflict]);
        if (idx >= 0) rows[idx] = { ...rows[idx], ...item, updated_at: new Date().toISOString() };
        else rows.push({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...item });
      }
      return { data: toUpsert, error: null };
    }

    if (this._op === 'update') {
      let matched = rows.filter((r) => this._filters.every((f) => f(r)));
      for (const row of matched) Object.assign(row, this._updateData);
      const result = matched.map((r) => ({ ...r }));
      return { data: result, error: null };
    }

    if (this._op === 'delete') {
      const before = rows.length;
      const toKeep = rows.filter((r) => !this._filters.every((f) => f(r)));
      this._store.set(this._table, toKeep);
      return { data: { count: before - toKeep.length }, error: null };
    }

    // select
    let result = rows.filter((r) => this._filters.every((f) => f(r)));
    if (this._order) {
      const { col, asc } = this._order;
      result = [...result].sort((a, b) => {
        const av = String(a[col] ?? ''), bv = String(b[col] ?? '');
        return asc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (this._limit != null) result = result.slice(0, this._limit);
    if (this._single) return { data: result[0] ?? null, error: null };
    return { data: result, error: null };
  }
}

export class MockSupabase {
  private store = new Map<string, Row[]>();

  from(table: string) {
    return new QueryBuilder(table, this.store);
  }

  rpc(fn: string, params?: Record<string, unknown>): Promise<{ data: unknown; error: null }> {
    if (fn === 'semantic_search') {
      const rows = (this.store.get('decisions') ?? [])
        .filter((r) => r.embedding != null)
        .map((r) => ({
          source_type: 'decision',
          source_id: r.id,
          title: r.question,
          content: `${r.chosen ?? ''} — ${r.rationale ?? ''}`,
          company: r.company ?? null,
          similarity: 0.8,
          created_at: r.created_at,
        }));
      const count = (params?.match_count as number) ?? 10;
      return Promise.resolve({ data: rows.slice(0, count), error: null });
    }
    return Promise.resolve({ data: [], error: null });
  }

  // Seed helper for tests
  seed(table: string, rows: Row[]) {
    if (!this.store.has(table)) this.store.set(table, []);
    this.store.get(table)!.push(...rows);
  }

  getRows(table: string): Row[] {
    return this.store.get(table) ?? [];
  }

  clear(table?: string) {
    if (table) this.store.set(table, []);
    else this.store.clear();
  }
}
