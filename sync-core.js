/* Little Days sync core: the planner as individual items.
   Each activity, to-do, child, chore, routine, reward, reward request, chore/routine
   tick, star bank and settings record is one item { kind, id, data }. Items sync
   on their own, so two devices editing different things never collide.

   Must match the SQL in supabase/migrations/20261018000000_item_sync.sql
   (function planner_items_from_blob).                                         */
(function (root, factory) {
  const s = factory();
  if (typeof module === 'object' && module.exports) module.exports = s;
  else root.LittleDaysSyncCore = s;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  /* kind -> planner array */
  const LISTS = { kid: 'kids', event: 'events', task: 'tasks', chore: 'chores', routine: 'routines', reward: 'rewards', redemption: 'redemptions', list: 'lists', listitem: 'listItems' };
  const KINDS = [...Object.keys(LISTS), 'log', 'bank', 'setting'];
  const keyOf = (kind, id) => kind + ':' + id;
  const splitKey = key => { const i = key.indexOf(':'); return [key.slice(0, i), key.slice(i + 1)]; };
  /* Stable JSON so the same object always gives the same text. */
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }

  /* planner -> Map(key -> data) */
  function flatten(p) {
    const out = new Map();
    for (const [kind, list] of Object.entries(LISTS)) {
      for (const item of Array.isArray(p?.[list]) ? p[list] : []) if (item && item.id != null) out.set(keyOf(kind, String(item.id)), item);
    }
    for (const [day, items] of Object.entries(p?.log || {})) for (const [id, entry] of Object.entries(items || {})) out.set(keyOf('log', day + '|' + id), entry);
    for (const [kidId, n] of Object.entries(p?.starBank || {})) out.set(keyOf('bank', kidId), { stars: Number(n) || 0 });
    if (p?.settings && Object.keys(p.settings).length) out.set(keyOf('setting', 'settings'), p.settings);
    return out;
  }

  /* Map(key -> stable text): what a device last agreed with the server. */
  const fingerprint = p => new Map([...flatten(p)].map(([k, v]) => [k, stable(v)]));

  /* Local changes since `base` (a fingerprint): [{ kind, id, data, deleted }] */
  function diff(p, base) {
    const now = flatten(p), changes = [];
    for (const [key, val] of now) if (base.get(key) !== stable(val)) { const [kind, id] = splitKey(key); changes.push({ kind, id, data: val, deleted: false }); }
    for (const key of base.keys()) if (!now.has(key)) { const [kind, id] = splitKey(key); changes.push({ kind, id, data: null, deleted: true }); }
    return changes;
  }

  /* Apply one item (from the server or the outbox) to the planner in place. */
  function applyItem(p, { kind, id, data, deleted }) {
    id = String(id);
    if (LISTS[kind]) {
      const list = Array.isArray(p[LISTS[kind]]) ? p[LISTS[kind]] : (p[LISTS[kind]] = []);
      const i = list.findIndex(x => String(x.id) === id);
      if (deleted || data == null) { if (i >= 0) list.splice(i, 1); }
      else if (i >= 0) list[i] = data; else list.push(data);
    } else if (kind === 'log') {
      const bar = id.indexOf('|'), day = id.slice(0, bar), itemId = id.slice(bar + 1);
      p.log = p.log && typeof p.log === 'object' ? p.log : {};
      if (deleted || data == null) { if (p.log[day]) { delete p.log[day][itemId]; if (!Object.keys(p.log[day]).length) delete p.log[day]; } }
      else (p.log[day] ||= {})[itemId] = data;
    } else if (kind === 'bank') {
      p.starBank = p.starBank && typeof p.starBank === 'object' ? p.starBank : {};
      if (deleted || data == null) delete p.starBank[id]; else p.starBank[id] = Number(data.stars) || 0;
    } else if (kind === 'setting') {
      if (!deleted && data) p.settings = data;
    }
    return p;
  }

  /* Rebuild a whole planner from server rows (deleted rows skipped). */
  function fromItems(rows) {
    const p = { kids: [], events: [], tasks: [] };
    for (const r of rows) if (!r.deleted && KINDS.includes(r.kind)) applyItem(p, r);
    return p;
  }

  /* Offline queue: newer changes to the same item replace older ones. */
  function mergeOutbox(outbox, changes) {
    const m = new Map((outbox || []).map(c => [keyOf(c.kind, c.id), c]));
    for (const c of changes) m.set(keyOf(c.kind, c.id), c);
    return [...m.values()];
  }

  return { LISTS, KINDS, keyOf, splitKey, stable, flatten, fingerprint, diff, applyItem, fromItems, mergeOutbox };
});
