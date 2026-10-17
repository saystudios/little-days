/* Little Days kids core: chores, routines, stars, rewards and streaks.
   Pure functions over the planner object, shared by the page and the tests.

   Planner fields (all optional, so older planners keep working):
     chores:      [{ id, title, emoji, kidId, days: [0-6] (empty = every day), stars, approval }]
     routines:    [{ id, kidId, name, emoji, steps: [{ id, title, emoji }], stars }]
     rewards:     [{ id, title, emoji, cost }]
     log:         { 'YYYY-MM-DD': { [choreOrRoutineId]: { kidId, stars, ok, steps?, at } } }
                  ok = the stars count (chore approved, or routine finished)
     redemptions: [{ id, kidId, rewardId, title, emoji, cost, status: 'asked'|'given'|'declined', at }]
     starBank:    { [kidId]: stars earned on days that have been tidied out of the log }
     settings:    { stars: true }                                                          */
(function (root, factory) {
  const k = factory(typeof module === 'object' && module.exports ? require('./planner-core.js') : root.LittleDaysCore);
  if (typeof module === 'object' && module.exports) module.exports = k;
  else root.LittleDaysKids = k;
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const { dateKey, parseDate, plusDays } = core;
  const LOG_DAYS = 120;   // how much day-by-day history to keep

  function ensure(d) {
    for (const f of ['chores', 'routines', 'rewards', 'redemptions']) if (!Array.isArray(d[f])) d[f] = [];
    if (!d.log || typeof d.log !== 'object' || Array.isArray(d.log)) d.log = {};
    if (!d.starBank || typeof d.starBank !== 'object') d.starBank = {};
    if (!d.settings || typeof d.settings !== 'object') d.settings = {};
    if (d.settings.stars === undefined) d.settings.stars = true;
    return d;
  }

  const entry = (d, day, id) => d.log?.[day]?.[id] || null;
  const isDue = (chore, day) => !chore.days?.length || chore.days.map(Number).includes(parseDate(day).getDay());
  const choresFor = (d, kidId, day) => (d.chores || []).filter(c => c.kidId === kidId && isDue(c, day));
  const routinesFor = (d, kidId) => (d.routines || []).filter(r => r.kidId === kidId);

  /* 'todo' | 'waiting' (needs a grown-up) | 'done' */
  function choreStatus(d, chore, day) {
    const e = entry(d, day, chore.id);
    if (!e) return 'todo';
    return e.ok ? 'done' : 'waiting';
  }

  function setEntry(d, day, id, value) {
    if (!d.log[day]) d.log[day] = {};
    if (value) d.log[day][id] = value; else { delete d.log[day][id]; if (!Object.keys(d.log[day]).length) delete d.log[day]; }
  }

  /* A child (or parent) ticks a chore. Returns the new status. */
  function toggleChore(d, chore, day, { byParent = false, now = new Date() } = {}) {
    ensure(d);
    const e = entry(d, day, chore.id);
    if (e) { setEntry(d, day, chore.id, null); return 'todo'; }
    const ok = byParent || !chore.approval;
    setEntry(d, day, chore.id, { kidId: chore.kidId, stars: Number(chore.stars) || 0, ok, at: now.toISOString() });
    return ok ? 'done' : 'waiting';
  }

  function approveChore(d, chore, day) {
    const e = entry(d, day, chore.id);
    if (e) e.ok = true;
    return !!e;
  }

  /* Routine progress: which steps are ticked today. Finishing every step earns its stars. */
  function routineSteps(d, routine, day) { return entry(d, day, routine.id)?.steps || []; }
  function routineDone(d, routine, day) { return !!routine.steps?.length && routine.steps.every(s => routineSteps(d, routine, day).includes(s.id)); }
  function toggleStep(d, routine, stepId, day, { now = new Date() } = {}) {
    ensure(d);
    const steps = new Set(routineSteps(d, routine, day));
    steps.has(stepId) ? steps.delete(stepId) : steps.add(stepId);
    const list = (routine.steps || []).map(s => s.id).filter(id => steps.has(id));
    if (!list.length) { setEntry(d, day, routine.id, null); return false; }
    const done = list.length === routine.steps.length;
    setEntry(d, day, routine.id, { kidId: routine.kidId, steps: list, stars: Number(routine.stars) || 0, ok: done, at: now.toISOString() });
    return done;
  }

  /* Stars --------------------------------------------------------------- */
  function earned(d, kidId, from = null, to = null) {
    let total = from || to ? 0 : Number(d.starBank?.[kidId]) || 0;
    for (const [day, items] of Object.entries(d.log || {})) {
      if ((from && day < from) || (to && day > to)) continue;
      for (const e of Object.values(items)) if (e.kidId === kidId && e.ok) total += Number(e.stars) || 0;
    }
    return total;
  }
  const spent = (d, kidId) => (d.redemptions || []).filter(r => r.kidId === kidId && r.status === 'given').reduce((n, r) => n + (Number(r.cost) || 0), 0);
  const asked = (d, kidId) => (d.redemptions || []).filter(r => r.kidId === kidId && r.status === 'asked').reduce((n, r) => n + (Number(r.cost) || 0), 0);
  const balance = (d, kidId) => earned(d, kidId) - spent(d, kidId);
  /* Stars a child can still put toward a new request. */
  const available = (d, kidId) => balance(d, kidId) - asked(d, kidId);

  function askReward(d, kidId, reward, { now = new Date(), id } = {}) {
    ensure(d);
    if (available(d, kidId) < (Number(reward.cost) || 0)) return null;
    const r = { id: id || 'r' + now.getTime().toString(36) + Math.random().toString(36).slice(2, 6), kidId, rewardId: reward.id,
      title: reward.title, emoji: reward.emoji, cost: Number(reward.cost) || 0, status: 'asked', at: now.toISOString() };
    d.redemptions.push(r);
    return r;
  }
  function decide(d, redemptionId, give) {
    const r = (d.redemptions || []).find(x => x.id === redemptionId);
    if (!r || r.status !== 'asked') return false;
    if (give && balance(d, r.kidId) < r.cost) return false;
    r.status = give ? 'given' : 'declined';
    return true;
  }

  /* Progress and streaks --------------------------------------------------- */
  function dayProgress(d, kidId, day) {
    const chores = choresFor(d, kidId, day);
    const done = chores.filter(c => choreStatus(d, c, day) !== 'todo').length;
    return { due: chores.length, done };
  }
  function weekProgress(d, kidId, today) {
    const t = parseDate(today), start = plusDays(t, -t.getDay());
    let due = 0, done = 0;
    for (let i = 0; i < 7; i++) {
      const day = dateKey(plusDays(start, i)), p = dayProgress(d, kidId, day);
      due += p.due; done += day <= today ? p.done : 0;
    }
    return { due, done, stars: earned(d, kidId, dateKey(start), dateKey(plusDays(start, 6))) };
  }
  /* Days in a row with every chore done. Today counts once finished; days
     with no chores due don't break the streak. */
  function streak(d, kidId, today) {
    let n = 0, day = parseDate(today);
    const hasChores = (d.chores || []).some(c => c.kidId === kidId);
    if (!hasChores) return 0;
    const t = dayProgress(d, kidId, today);
    if (!(t.due && t.done === t.due)) day = plusDays(day, -1);
    for (let i = 0; i < 366; i++, day = plusDays(day, -1)) {
      const key = dateKey(day), p = dayProgress(d, kidId, key);
      if (!p.due) { if (!Object.keys(d.log || {}).some(k => k <= key)) break; continue; }
      if (p.done < p.due) break;
      n++;
    }
    return n;
  }

  /* Things waiting for a grown-up, newest first. */
  function pending(d) {
    const out = [];
    for (const [day, items] of Object.entries(d.log || {})) for (const [id, e] of Object.entries(items)) {
      if (e.ok || e.steps) continue;
      const chore = (d.chores || []).find(c => c.id === id);
      if (chore) out.push({ type: 'chore', day, chore, kidId: e.kidId, at: e.at });
    }
    for (const r of d.redemptions || []) if (r.status === 'asked') out.push({ type: 'reward', redemption: r, kidId: r.kidId, at: r.at });
    return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }

  /* Keep the log small: fold days older than LOG_DAYS into each child's star bank. */
  function tidy(d, today) {
    ensure(d);
    const cutoff = dateKey(plusDays(parseDate(today), -LOG_DAYS));
    for (const day of Object.keys(d.log)) {
      if (day >= cutoff) continue;
      for (const e of Object.values(d.log[day])) if (e.ok) d.starBank[e.kidId] = (Number(d.starBank[e.kidId]) || 0) + (Number(e.stars) || 0);
      delete d.log[day];
    }
    const old = dateKey(plusDays(parseDate(today), -365));
    d.redemptions = d.redemptions.filter(r => r.status === 'asked' || String(r.at).slice(0, 10) >= old);
    return d;
  }

  /* Age from a birthday on a given day. */
  function ageOn(birthday, today) {
    if (!core.isDateKey(birthday)) return null;
    const b = parseDate(birthday), t = parseDate(today);
    let a = t.getFullYear() - b.getFullYear();
    if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
    return a;
  }

  /* Age-appropriate chore ideas. */
  const IDEAS = [
    { min: 3, title: 'Put toys away', emoji: '🧸' }, { min: 3, title: 'Brush teeth', emoji: '🪥' },
    { min: 3, title: 'Put clothes in the hamper', emoji: '🧺' }, { min: 4, title: 'Feed the pet', emoji: '🐶' },
    { min: 4, title: 'Make bed', emoji: '🛏️' }, { min: 5, title: 'Set the table', emoji: '🍽️' },
    { min: 5, title: 'Water the plants', emoji: '🪴' }, { min: 6, title: 'Read for 20 minutes', emoji: '📚' },
    { min: 6, title: 'Pack backpack', emoji: '🎒' }, { min: 6, title: 'Clean bedroom', emoji: '🧹' },
    { min: 7, title: 'Practice piano', emoji: '🎹' }, { min: 7, title: 'Homework', emoji: '✏️' },
    { min: 8, title: 'Unload the dishwasher', emoji: '🍴' }, { min: 8, title: 'Fold laundry', emoji: '👕' },
    { min: 10, title: 'Take out the trash', emoji: '🗑️' }, { min: 10, title: 'Vacuum a room', emoji: '🧽' },
    { min: 12, title: 'Help cook dinner', emoji: '🍳' }, { min: 12, title: 'Mow the lawn', emoji: '🌱' }
  ];
  const ideasFor = age => age == null ? IDEAS : IDEAS.filter(i => i.min <= Math.max(3, age));

  const ROUTINE_TEMPLATES = [
    { name: 'Morning', emoji: '☀️', steps: [['Wake up', '⏰'], ['Brush teeth', '🪥'], ['Get dressed', '👕'], ['Eat breakfast', '🥣'], ['Pack backpack', '🎒'], ['Leave for school', '🚌']] },
    { name: 'After school', emoji: '🏡', steps: [['Snack', '🍎'], ['Homework', '✏️'], ['Practice', '⚽'], ['Reading', '📚'], ['Free time', '🎮']] },
    { name: 'Bedtime', emoji: '🌙', steps: [['Take a bath', '🛁'], ['Put on pajamas', '🩳'], ['Brush teeth', '🪥'], ['Prepare school bag', '🎒'], ['Read', '📖'], ['Go to bed', '😴']] }
  ];

  return { ensure, isDue, choresFor, routinesFor, choreStatus, toggleChore, approveChore, routineSteps, routineDone, toggleStep,
    earned, balance, available, askReward, decide, dayProgress, weekProgress, streak, pending, tidy, ageOn, ideasFor, IDEAS, ROUTINE_TEMPLATES, LOG_DAYS };
});
