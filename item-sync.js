/* Little Days per-item sync engine (used by cloud.js once the item-sync
   database update is installed).

   - Local planner stays in localStorage; every save() queues only the items
     that changed (an "outbox", also kept in localStorage, so changes made
     offline survive closing the app and send when the device is back online).
   - Changes from other devices arrive live (Supabase Realtime) plus a light
     catch-up check every minute, when the app comes back to the foreground and
     when the network returns.
   - Same item changed on two devices: the newest save wins and the device that
     saved second is told. Different items never affect each other.          */
(function (root) {
  'use strict';
  const S = root.LittleDaysSyncCore;
  const PAGE = 1000, BATCH = 400, OVERLAP_MS = 2 * 60 * 1000;

  function create({ client, family, getData, setData, onChange, onStatus, onNotice, storage = root.localStorage }) {
    const k = name => `ld_sync_${name}_${family}`;
    const load = (name, d) => { try { const v = JSON.parse(storage.getItem(k(name)) || 'null'); return v ?? d; } catch { return d; } };
    const store = (name, v) => { try { storage.setItem(k(name), JSON.stringify(v)); } catch { onNotice?.('This device is out of storage space. Export a backup.', true); } };

    let base = new Map(load('base', []));            // key -> stable text the server has
    let versions = new Map(load('versions', []));    // key -> server updated_at
    let outbox = load('outbox', []);                 // pending changes
    let since = load('since', null);                 // newest updated_at seen
    let channel = null, flushTimer = null, pollTimer = null, retryMs = 0, flushing = null, stopped = false;

    const persist = () => { store('base', [...base]); store('versions', [...versions]); store('outbox', outbox); store('since', since); };
    /* Server times as microseconds, whatever format they arrive in. */
    const micros = t => {
      if (!t) return 0;
      const s = String(t).replace(' ', 'T'), frac = (s.match(/\.(\d+)/)?.[1] || '') + '000000';
      const ms = Date.parse(s.replace(/\.\d+/, '').replace(/([+-]\d\d)$/, '$1:00'));
      return ms * 1000 + Number(frac.slice(0, 6));
    };
    const later = (a, b) => (!a ? b : !b ? a : (micros(a) >= micros(b) ? a : b));
    const pendingKeys = () => new Set(outbox.map(c => S.keyOf(c.kind, c.id)));
    const report = () => {
      if (stopped) return;
      if (!navigator.onLine && outbox.length) return onStatus(`Offline · ${outbox.length} waiting`);
      if (!navigator.onLine) return onStatus('Offline');
      onStatus(outbox.length ? 'Saving…' : '☁️ Synced');
    };

    async function fetchRows(after) {
      const rows = [];
      for (let from = 0; ; from += PAGE) {
        let q = client.from('planner_items').select('kind,id,data,deleted,updated_at').eq('family_id', family);
        if (after) q = q.gt('updated_at', new Date(new Date(after).getTime() - OVERLAP_MS).toISOString());
        const { data, error } = await q.order('updated_at', { ascending: true }).range(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...data);
        if (data.length < PAGE) return rows;
      }
    }

    /* Apply rows from the server. Items with local changes still waiting to
       send are left alone; our newer save will reach the server shortly. */
    function applyRows(rows) {
      const waiting = pendingKeys(), d = getData();
      let changed = false;
      for (const r of rows) {
        if (!S.KINDS.includes(r.kind)) continue;
        const key = S.keyOf(r.kind, r.id);
        since = later(since, r.updated_at);
        if (waiting.has(key)) continue;
        const known = versions.get(key);
        if (known && micros(known) >= micros(r.updated_at)) continue;
        versions.set(key, r.updated_at);
        const text = r.deleted ? null : S.stable(r.data);
        if ((base.get(key) ?? null) === text) continue;
        if (text == null) base.delete(key); else base.set(key, text);
        S.applyItem(d, r);
        changed = true;
      }
      persist();
      if (changed) onChange(d);
      return changed;
    }

    /* First connection on this device: the server copy becomes the planner
       (a backup of the device's own copy is kept). */
    async function fullPull() {
      const rows = await fetchRows(null);
      const fresh = S.fromItems(rows);
      const local = getData();
      try { storage.setItem('littledays_v1_before_sync', JSON.stringify({ savedAt: new Date().toISOString(), planner: local })); } catch { /* best effort */ }
      base = new Map(rows.filter(r => !r.deleted).map(r => [S.keyOf(r.kind, r.id), S.stable(r.data)]));
      versions = new Map(rows.map(r => [S.keyOf(r.kind, r.id), r.updated_at]));
      since = rows.reduce((m, r) => later(m, r.updated_at), null);
      // Keep anything changed locally before the first sync finished.
      for (const c of outbox) S.applyItem(fresh, c);
      persist();
      setData(fresh);
    }

    async function pull() {
      if (stopped || !navigator.onLine) return;
      try { applyRows(await fetchRows(since)); report(); }
      catch (e) { if (navigator.onLine) onNotice?.(e, true); }
    }

    function queue() {
      if (stopped) return;
      const changes = S.diff(getData(), base);
      if (!changes.length) return report();
      for (const c of changes) {
        const key = S.keyOf(c.kind, c.id);
        if (c.deleted) base.delete(key); else base.set(key, S.stable(c.data));
      }
      outbox = S.mergeOutbox(outbox, changes.map(c => ({ ...c, base: versions.get(S.keyOf(c.kind, c.id)) || null })));
      persist(); report();
      clearTimeout(flushTimer); flushTimer = setTimeout(flush, 500);
    }

    async function flush() {
      if (stopped || flushing || !outbox.length) return flushing;
      if (!navigator.onLine) return report();
      const batch = outbox.slice(0, BATCH);
      flushing = (async () => {
        try {
          const { data: rows, error } = await client.rpc('save_items', { fid: family, items: batch });
          if (error) throw error;
          let conflicts = 0;
          for (const r of rows || []) {
            versions.set(S.keyOf(r.kind, r.id), r.updated_at);
            if (r.conflict) conflicts++;
          }
          const sent = new Set(batch);
          outbox = outbox.filter(c => !sent.has(c));      // keep anything changed again while sending
          retryMs = 0; persist();
          if (conflicts) onNotice?.(conflicts === 1 ? 'Someone else changed that on another device too. Your latest change was kept.'
            : `${conflicts} things were also changed on another device. Your latest changes were kept.`);
        } catch (e) {
          retryMs = Math.min(60000, (retryMs || 2500) * 2);
          if (navigator.onLine) onNotice?.(e, true);
          setTimeout(flush, retryMs);
        } finally {
          flushing = null; report();
          if (outbox.length && !retryMs) setTimeout(flush, 50);
        }
      })();
      return flushing;
    }

    async function start() {
      report();
      if (!since && !versions.size) await fullPull(); else await pull();
      channel = client.channel('items-' + family).on('postgres_changes',
        { event: '*', schema: 'public', table: 'planner_items', filter: 'family_id=eq.' + family },
        payload => { if (payload.new && payload.new.kind) { applyRows([payload.new]); report(); } }).subscribe();
      pollTimer = setInterval(() => { if (document.visibilityState === 'visible') { pull(); flush(); } }, 60000);
      root.addEventListener('online', onOnline);
      root.addEventListener('offline', report);
      document.addEventListener('visibilitychange', onVisible);
      await flush();
      report();
    }
    const onOnline = () => { retryMs = 0; flush(); pull(); };
    const onVisible = () => { if (document.visibilityState === 'visible') { pull(); flush(); } };

    function stop() {
      stopped = true;
      clearTimeout(flushTimer); clearInterval(pollTimer);
      if (channel) client.removeChannel(channel);
      root.removeEventListener('online', onOnline);
      root.removeEventListener('offline', report);
      document.removeEventListener('visibilitychange', onVisible);
    }
    /* Forget this family's sync state (after leaving it or deleting the account). */
    function forget() { stop(); ['base', 'versions', 'outbox', 'since'].forEach(n => storage.removeItem(k(n))); }

    return { start, stop, forget, queue, flush, pull, pending: () => outbox.length };
  }

  root.LittleDaysItemSync = { create };
})(typeof self !== 'undefined' ? self : this);
