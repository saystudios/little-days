/* Little Days scan helpers: turn what the AI read from a photo into activity
   drafts the parent can check. Pure functions shared by scan.js and the tests.
   Anything that doesn't look right is dropped or blanked, never guessed.      */
(function (root, factory) {
  const r = factory(typeof module === 'object' && module.exports ? require('./planner-core.js') : root.LittleDaysCore);
  if (typeof module === 'object' && module.exports) module.exports = r;
  else root.LittleDaysScanCore = r;
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const CATEGORIES = ['School', 'Sports', 'Music', 'Appointment', 'Family', 'Birthday', 'Holiday', 'Other'];
  const MAX_EDGE = 1568;   // longest side sent to the AI; larger adds cost, not accuracy

  const text = (v, max) => typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
  /* "9:05", "09:05" or "21:30" → "HH:MM"; anything else → "". */
  function time(v) {
    const m = typeof v === 'string' && /^\s*(\d{1,2}):(\d{2})\s*$/.exec(v);
    if (!m) return '';
    const h = Number(m[1]), min = Number(m[2]);
    return h < 24 && min < 60 ? String(h).padStart(2, '0') + ':' + m[2] : '';
  }
  /* Match the AI's "who" to a child: exact name, then first name. */
  function kidFor(who, kids) {
    const w = text(who, 40).toLowerCase();
    if (!w || !Array.isArray(kids)) return '';
    const exact = kids.find(k => String(k.name || '').trim().toLowerCase() === w);
    if (exact) return exact.id;
    const first = kids.filter(k => String(k.name || '').trim().toLowerCase().split(' ')[0] === w.split(' ')[0]);
    return first.length === 1 ? first[0].id : '';
  }

  function toDraft(raw, kids) {
    if (!raw || typeof raw !== 'object') return null;
    const title = text(raw.title, 90), date = raw.date;
    if (!title || !core.isDateKey(date)) return null;
    const start = time(raw.time);
    let end = start ? time(raw.endTime) : '';
    if (end && end <= start) end = '';
    const d = {
      title, kidId: kidFor(raw.who, kids), category: CATEGORIES.includes(raw.category) ? raw.category : 'Other',
      date, time: start, endTime: end, location: text(raw.location, 120), pickupBy: '',
      notes: typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 500) : '', repeat: 'none'
    };
    const days = Array.isArray(raw.repeatWeekdays)
      ? [...new Set(raw.repeatWeekdays.filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort() : [];
    if (days.length) {
      d.repeat = 'weekly'; d.interval = 1; d.days = days;
      d.until = core.isDateKey(raw.until) && raw.until >= date ? raw.until : '';
    }
    return d;
  }

  /* AI events → sorted, de-duplicated drafts. */
  function toDrafts(list, kids) {
    const seen = new Set(), out = [];
    for (const raw of Array.isArray(list) ? list : []) {
      const d = toDraft(raw, kids);
      if (!d) continue;
      const key = [d.title.toLowerCase(), d.date, d.time, d.kidId].join('|');
      if (seen.has(key)) continue;
      seen.add(key); out.push(d);
    }
    return out.sort((a, b) => (a.date + (a.time || '00:00')).localeCompare(b.date + (b.time || '00:00')));
  }

  /* Size to draw a photo at so its longest side is at most MAX_EDGE. */
  function fitSize(w, h, max = MAX_EDGE) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    const s = Math.min(1, max / Math.max(w, h));
    return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
  }

  /* Is this draft already in the planner (same name, day and time)? */
  function isDuplicate(d, events) {
    return (events || []).some(e => String(e.title || '').trim().toLowerCase() === d.title.toLowerCase()
      && e.date === d.date && (e.time || '') === d.time);
  }

  return { CATEGORIES, MAX_EDGE, time, kidFor, toDraft, toDrafts, fitSize, isDuplicate };
});
