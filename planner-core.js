/* Little Days planner core: date helpers and repeat expansion.
   Shared by the web page (window.LittleDaysCore) and the Node tests (require).
   Dates are plain calendar days ("YYYY-MM-DD") in the device's local time, so
   daylight-saving changes never shift an event to a different day. */
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.LittleDaysCore = core;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const plusDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  /* Whole calendar days from a to b. Uses UTC so a 23- or 25-hour DST day
     still counts as exactly one day. */
  const daysBetween = (a, b) =>
    Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
                Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  const isDateKey = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && dateKey(parseDate(s)) === s;

  /* Every day in [start, end] (inclusive date keys) on which the event happens. */
  function occurrences(e, start, end) {
    const res = [];
    if (!e || !isDateKey(e.date) || !isDateKey(start) || !isDateKey(end)) return res;
    const base = parseDate(e.date), first = parseDate(start), last = parseDate(end);
    if (last < base) return res;
    const push = d => res.push({ ...e, on: dateKey(d) });
    if (e.repeat === 'weekly') {
      let d = base;
      if (d < first) d = plusDays(base, Math.ceil(daysBetween(base, first) / 7) * 7);
      for (; d <= last; d = plusDays(d, 7)) push(d);
    } else if (e.repeat === 'daily') {
      for (let d = base < first ? first : base; d <= last; d = plusDays(d, 1)) push(d);
    } else if (base >= first && base <= last) {
      push(base);
    }
    return res;
  }

  /* Events across the whole family in a date range, sorted by day then time. */
  function expandEvents(events, start, end) {
    return (events || []).flatMap(e => occurrences(e, start, end))
      .sort((a, b) => a.on.localeCompare(b.on) || (a.time || '').localeCompare(b.time || ''));
  }

  /* The moment an occurrence starts, in the device's local time zone. */
  function startsAt(on, time) {
    if (!isDateKey(on) || !/^\d{2}:\d{2}$/.test(time || '')) return null;
    const [h, m] = time.split(':').map(Number);
    const d = parseDate(on);
    d.setHours(h, m, 0, 0);
    return d;
  }

  /* A planner object loaded from storage, a backup file or the cloud. */
  const isPlanner = x => !!x && Array.isArray(x.kids) && Array.isArray(x.events) && Array.isArray(x.tasks);

  return { pad, dateKey, parseDate, plusDays, daysBetween, isDateKey, occurrences, expandEvents, startsAt, isPlanner };
});
