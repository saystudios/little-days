/* Little Days reminder schedule: which notifications to show, and when.
   Pure function shared by the iPhone/iPad app (scheduled with the system, so
   they arrive even when the app is closed), the website (only while it's open)
   and the tests.                                                               */
(function (root, factory) {
  const r = factory(typeof module === 'object' && module.exports ? require('./planner-core.js') : root.LittleDaysCore);
  if (typeof module === 'object' && module.exports) module.exports = r;
  else root.LittleDaysReminders = r;
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const { dateKey, parseDate, plusDays, expandEvents, startsAt } = core;
  const DEFAULTS = { activities: true, minutes: 10, birthdays: true, summary: false, summaryTime: '07:00', quiet: true, quietStart: '21:30', quietEnd: '06:30' };
  const MAX = 60;          // iOS keeps at most 64 pending notifications per app
  const DAYS_AHEAD = 7;

  const prefsOf = p => ({ ...DEFAULTS, ...(p || {}) });
  const mins = t => /^\d{2}:\d{2}$/.test(t || '') ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null;
  /* Quiet hours may wrap past midnight (21:30–06:30). */
  function isQuiet(date, p) {
    if (!p.quiet) return false;
    const s = mins(p.quietStart), e = mins(p.quietEnd), m = date.getHours() * 60 + date.getMinutes();
    if (s == null || e == null || s === e) return false;
    return s < e ? m >= s && m < e : m >= s || m < e;
  }
  /* Stable positive 31-bit id from a string (system notifications need integers). */
  function idFor(key) {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 1) || 1;
  }
  const at = (day, time) => startsAt(day, time);
  const fmt = (d, opts) => d.toLocaleTimeString(undefined, opts || { hour: 'numeric', minute: '2-digit' });

  function build(planner, { now = new Date(), prefs } = {}) {
    const p = prefsOf(prefs), out = [];
    const kids = planner?.kids || [];
    const kidName = id => kids.find(k => k.id === id)?.name || '';
    const start = dateKey(now), end = dateKey(plusDays(now, DAYS_AHEAD));
    const events = expandEvents(planner?.events || [], start, end);

    if (p.activities) for (const e of events) {
      const when = at(e.on, e.time); if (!when) continue;
      const fire = new Date(when.getTime() - (Number(p.minutes) || 0) * 60000);
      const who = kidName(e.kidId);
      const details = [fmt(when), who, e.location, e.pickupBy ? '🚗 ' + e.pickupBy : ''].filter(Boolean).join(' · ');
      out.push({ key: `a|${e.id}|${e.on}|${e.time}`, kind: 'activity', at: fire,
        title: Number(p.minutes) > 0 ? `${e.title} in ${p.minutes >= 60 ? (p.minutes / 60) + ' hr' : p.minutes + ' min'}` : e.title, body: details });
    }

    if (p.birthdays) for (const k of kids) {
      if (!core.isDateKey(k.birthday)) continue;
      const b = parseDate(k.birthday);
      for (let y = now.getFullYear(); y <= now.getFullYear() + 1; y++) {
        if (b.getMonth() === 1 && b.getDate() === 29 && new Date(y, 1, 29).getMonth() !== 1) continue;
        const day = dateKey(new Date(y, b.getMonth(), b.getDate()));
        if (day < start || day > end) continue;
        out.push({ key: `b|${k.id}|${day}`, kind: 'birthday', at: at(day, p.summaryTime || '07:00'),
          title: `🎂 ${k.name} turns ${y - b.getFullYear()} today!`, body: 'Happy birthday from Little Days.' });
      }
    }

    if (p.summary) for (let i = 0; i <= DAYS_AHEAD; i++) {
      const day = dateKey(plusDays(now, i)), todays = events.filter(e => e.on === day);
      if (!todays.length) continue;
      const timed = todays.filter(e => e.time), first = timed[0];
      const pickups = todays.filter(e => e.pickupBy).length;
      out.push({ key: `s|${day}`, kind: 'summary', at: at(day, p.summaryTime),
        title: `Today: ${todays.length} ${todays.length === 1 ? 'activity' : 'activities'}`,
        body: [first ? `First: ${first.title} at ${fmt(at(day, first.time))}` : '', pickups ? `${pickups} pickup${pickups > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ') || todays.map(e => e.title).join(', ') });
    }

    return out
      .filter(n => n.at && n.at > now && !isQuiet(n.at, p))
      .sort((a, b) => a.at - b.at)
      .slice(0, MAX)
      .map(n => ({ ...n, id: idFor(n.key) }));
  }

  return { build, isQuiet, idFor, DEFAULTS, MAX, prefsOf };
});
