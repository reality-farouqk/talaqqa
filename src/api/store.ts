import { z } from 'zod';

// Per-user learning data, one item per (kind, key), mirroring the device store.
// Sync is last-write-wins per item using the client's change time in ms.

const lessonKey = z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'expected "course/lesson"').max(200);
const courseKey = z.string().regex(/^[a-z0-9-]+$/).max(200);
const at = z.number().int().min(Date.UTC(2024, 0, 1));
const flag = z.boolean(); // false removes the item

export const changeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('done'), key: lessonKey, value: flag, at }),
  z.object({ kind: z.literal('saved'), key: lessonKey, value: flag, at }),
  z.object({ kind: z.literal('watch'), key: courseKey, value: flag, at }),
  z.object({ kind: z.literal('position'), key: lessonKey, value: z.number().min(0).max(86400), at }),
  z.object({ kind: z.literal('note'), key: lessonKey, value: z.string().max(20000), at }),
  z.object({ kind: z.literal('day'), key: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), value: flag, at }),
  z.object({
    kind: z.literal('playlist'),
    key: z.string().regex(/^[a-z0-9]{6,20}$/),
    value: z.union([
      z.object({ title: z.string().min(1).max(120), visibility: z.enum(['private', 'public']), items: z.array(lessonKey).max(500) }),
      z.null() // deleted
    ]),
    at
  })
]);
export const changesSchema = z.object({ changes: z.array(changeSchema).min(1).max(500) });

export type Change = z.infer<typeof changeSchema>;
export interface Item { kind: Change['kind']; key: string; value: unknown; at: number; }
export interface Cursor { at: number; kind: string; key: string; }

export interface Store {
  /** Applies changes newer than what is stored; returns how many were applied. */
  apply(userId: string, changes: Change[]): Promise<number>;
  /** Items changed after the cursor, oldest first. */
  list(userId: string, after: Cursor, limit: number): Promise<Item[]>;
  /** Deletes the account and everything stored for it. */
  deleteUser(userId: string): Promise<void>;
}

/** Keeps only the newest change per (kind, key), so one batch can't touch a row twice. */
export function latestPerItem(changes: Change[]) {
  const map = new Map<string, Change>();
  for (const c of changes) {
    const id = `${c.kind}\u0000${c.key}`;
    const prev = map.get(id);
    if (!prev || c.at > prev.at) map.set(id, c);
  }
  return [...map.values()];
}

const cmp = (a: Cursor, b: Cursor) => a.at - b.at || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

export function memoryStore(): Store {
  const users = new Map<string, Map<string, Item>>();
  return {
    async apply(userId, changes) {
      const items = users.get(userId) ?? new Map();
      users.set(userId, items);
      let applied = 0;
      for (const c of latestPerItem(changes)) {
        const id = `${c.kind}\u0000${c.key}`;
        if ((items.get(id)?.at ?? -1) < c.at) { items.set(id, { kind: c.kind, key: c.key, value: c.value, at: c.at }); applied++; }
      }
      return applied;
    },
    async list(userId, after, limit) {
      return [...(users.get(userId)?.values() ?? [])].filter((i) => cmp(i, after) > 0).sort(cmp).slice(0, limit);
    },
    async deleteUser(userId) { users.delete(userId); }
  };
}

/** Minimal query interface: Neon's `neon(url).query` in production, psql in tests. */
export type Query = (text: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

export const SQL = {
  // One statement, so a batch applies atomically. The WHERE keeps the newer write.
  apply: `with applied as (
  insert into user_items (user_id, kind, key, value, updated_at)
  select $1, c.kind, c.key, c.value, c.at from jsonb_to_recordset($2::jsonb) as c(kind text, key text, value jsonb, at bigint)
  on conflict (user_id, kind, key) do update set value = excluded.value, updated_at = excluded.updated_at
  where user_items.updated_at < excluded.updated_at
  returning 1)
select count(*)::int as applied from applied`,
  list: `select kind, key, value, updated_at as at from user_items
where user_id = $1 and (updated_at, kind, key) > ($2::bigint, $3::text, $4::text)
order by updated_at, kind, key limit $5::int`,
  // Cascades to sessions, accounts and user_items.
  deleteUser: `delete from "user" where id = $1`
};

export function sqlStore(query: Query): Store {
  return {
    async apply(userId, changes) {
      const rows = await query(SQL.apply, [userId, JSON.stringify(latestPerItem(changes))]);
      return Number(rows[0]?.applied ?? 0);
    },
    async list(userId, after, limit) {
      const rows = await query(SQL.list, [userId, after.at, after.kind, after.key, limit]);
      return rows.map((r) => ({ kind: r.kind as Item['kind'], key: String(r.key), value: r.value, at: Number(r.at) }));
    },
    async deleteUser(userId) { await query(SQL.deleteUser, [userId]); }
  };
}
