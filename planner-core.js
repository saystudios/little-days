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

  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const ordinals = ['first', 'second', 'third', 'fourth', 'fifth'];
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  /* nth (1-5) weekday of a month, or the last one when nth is -1. null if it doesn't exist. */
  function nthWeekday(y, m, weekday, nth) {
    if (nth === -1) {
      const lastDay = daysInMonth(y, m), d = new Date(y, m, lastDay);
      return new Date(y, m, lastDay - ((d.getDay() - weekday + 7) % 7));
    }
    const firstDow = new Date(y, m, 1).getDay();
    const day = 1 + ((weekday - firstDow + 7) % 7) + (nth - 1) * 7;
    return day <= daysInMonth(y, m) ? new Date(y, m, day) : null;
  }
  const weekOfMonth = d => Math.ceil(d.getDate() / 7);                 // 1-5
  const isLastWeekdayOfMonth = d => d.getDate() + 7 > daysInMonth(d.getFullYear(), d.getMonth());

  /* Normalised repeat rule. Older planners only have repeat: 'daily' | 'weekly'.
     Fields: repeat ('none'|'daily'|'weekly'|'monthly'|'yearly'), interval (every N
     days/weeks), days (weekdays 0-6 for weekly), monthBy ('date'|'nth'|'last'),
     until (last day, optional), skip (dates removed from the series). */
  function ruleOf(e) {
    const base = parseDate(e.date);
    const repeat = ['daily', 'weekly', 'monthly', 'yearly'].includes(e.repeat) ? e.repeat : 'none';
    const interval = Math.max(1, Math.min(52, Math.floor(Number(e.interval) || 1)));
    let days = Array.isArray(e.days) ? [...new Set(e.days.map(Number).filter(n => n >= 0 && n <= 6))].sort() : [];
    if (!days.length) days = [base.getDay()];
    const monthBy = ['nth', 'last'].includes(e.monthBy) ? e.monthBy : 'date';
    return { repeat, interval, days, monthBy, until: isDateKey(e.until) ? e.until : '', skip: new Set(Array.isArray(e.skip) ? e.skip : []) };
  }

  /* Every day in [start, end] (inclusive date keys) on which the event happens. */
  function occurrences(e, start, end) {
    const res = [];
    if (!e || !isDateKey(e.date) || !isDateKey(start) || !isDateKey(end)) return res;
    const r = ruleOf(e);
    const base = parseDate(e.date), first = parseDate(start);
    let last = parseDate(end);
    if (r.until && parseDate(r.until) < last) last = parseDate(r.until);
    if (last < base || last < first) return res;
    const push = d => { if (d >= base && d >= first && d <= last) { const k = dateKey(d); if (!r.skip.has(k)) res.push({ ...e, on: k }); } };
    if (r.repeat === 'none') { push(base); return res; }
    if (r.repeat === 'daily') {
      let d = base;
      if (d < first) d = plusDays(base, Math.ceil(daysBetween(base, first) / r.interval) * r.interval);
      for (; d <= last; d = plusDays(d, r.interval)) push(d);
    } else if (r.repeat === 'weekly') {
      const week0 = plusDays(base, -base.getDay());                       // Sunday of the first week
      let w = Math.max(0, Math.floor(daysBetween(week0, first) / 7));
      w -= w % r.interval;
      for (let ws = plusDays(week0, w * 7); ws <= last; ws = plusDays(ws, 7 * r.interval)) {
        for (const day of r.days) push(plusDays(ws, day));
      }
    } else if (r.repeat === 'monthly') {
      const nth = r.monthBy === 'last' ? -1 : weekOfMonth(base);
      const idx = d => d.getFullYear() * 12 + d.getMonth();             // months since year 0
      for (let i = Math.max(idx(base), idx(first)); i <= idx(last); i++) {
        if ((i - idx(base)) % r.interval) continue;
        const y = Math.floor(i / 12), m = i % 12;
        if (r.monthBy === 'date') { if (base.getDate() <= daysInMonth(y, m)) push(new Date(y, m, base.getDate())); }
        else { const d = nthWeekday(y, m, base.getDay(), nth); if (d) push(d); }
      }
    } else if (r.repeat === 'yearly') {
      for (let y = Math.max(base.getFullYear(), first.getFullYear()); y <= last.getFullYear(); y++) {
        if (base.getDate() <= daysInMonth(y, base.getMonth())) push(new Date(y, base.getMonth(), base.getDate()));
      }
    }
    return res.sort((a, b) => a.on.localeCompare(b.on));
  }

  /* Plain-language description of an event's repeat rule. */
  function describeRepeat(e) {
    const r = ruleOf(e), base = parseDate(e.date);
    let text = '';
    if (r.repeat === 'none') return '';
    if (r.repeat === 'daily') text = r.interval === 1 ? 'Every day' : `Every ${r.interval} days`;
    if (r.repeat === 'weekly') {
      const names = r.days.length === 7 ? 'every day' : r.days.join() === '1,2,3,4,5' ? 'weekdays' : r.days.map(d => weekdayNames[d].slice(0, 3)).join(', ');
      text = (r.interval === 1 ? 'Weekly' : `Every ${r.interval} weeks`) + ' on ' + names;
    }
    if (r.repeat === 'monthly') {
      const every = r.interval === 1 ? 'Monthly' : `Every ${r.interval} months`;
      text = r.monthBy === 'date' ? `${every} on day ${base.getDate()}`
        : `${every} on the ${r.monthBy === 'last' ? 'last' : ordinals[weekOfMonth(base) - 1]} ${weekdayNames[base.getDay()]}`;
    }
    if (r.repeat === 'yearly') text = 'Every year';
    if (r.until) text += `, until ${parseDate(r.until).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    return text;
  }

  /* Minutes since midnight for "HH:MM", or null. */
  const minutesOf = t => /^\d{2}:\d{2}$/.test(t || '') ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null;

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

  return { pad, dateKey, parseDate, plusDays, daysBetween, isDateKey, occurrences, expandEvents, startsAt, isPlanner,
    ruleOf, describeRepeat, nthWeekday, weekOfMonth, isLastWeekdayOfMonth, minutesOf, weekdayNames, ordinals };
});
