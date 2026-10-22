/* Little Days Summit Climb core: turns what a child already does in Kid mode
   into meters up a mountain, plus their big dream, lessons and medals.
   Pure functions over the planner, shared by the page and the tests.

   No new storage kinds, so it syncs with the existing planner items:
     log:  { day: { 'viz-<kidId>': { kidId, viz: true, stars: 0, ok: false, at } } }
           (one entry per day the child finished the 1-minute visualization)
     kid.climb:   { bank, upTo, medals: [id], viz }   meters from days tidied out of the log
     kid.dream:   { text, why, steps: [{ id, title, done }] }
     kid.lessons: [{ id, day, oops, learn }]  (newest last, at most MAX_LESSONS) */
(function (root, factory) {
  const c = factory(typeof module === 'object' && module.exports ? require('./planner-core.js') : root.LittleDaysCore);
  if (typeof module === 'object' && module.exports) module.exports = c;
  else root.LittleDaysClimb = c;
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const { dateKey, parseDate, plusDays } = core;
  const PEAK = 3000, CHORE = 50, STEP = 20, VIZ = 50, MAX_LESSONS = 10, MAX_STEPS = 8;

  const vizId = kidId => 'viz-' + kidId;
  const climbOf = kid => (kid.climb && typeof kid.climb === 'object' ? kid.climb : (kid.climb = { bank: 0, upTo: '', medals: [], viz: 0 }));

  /* Meters one child climbed on one day: approved chores, every routine step
     ticked, and the visualization session. Chores waiting for a grown-up don't
     count yet, the same as stars. */
  function metersOn(d, kidId, day) {
    let m = 0;
    for (const e of Object.values(d.log?.[day] || {})) {
      if (!e || e.kidId !== kidId) continue;
      if (e.viz) m += VIZ;
      else if (Array.isArray(e.steps)) m += e.steps.length * STEP;
      else if (e.ok) m += CHORE;
    }
    return m;
  }

  function total(d, kid) {
    const c = kid.climb || {};
    let m = Number(c.bank) || 0;
    for (const day of Object.keys(d.log || {})) if (!c.upTo || day > c.upTo) m += metersOn(d, kid.id, day);
    return m;
  }

  /* Where the child is on the current mountain. */
  function position(m) {
    const done = Math.floor(m / PEAK), into = m - done * PEAK;
    return { summits: done, mountain: done + 1, into, left: PEAK - into, fraction: into / PEAK };
  }

  /* Days in a row with any climbing. Today counts once something is done. */
  function streak(d, kidId, today) {
    let day = parseDate(today), n = 0;
    if (!metersOn(d, kidId, today)) day = plusDays(day, -1);
    for (let i = 0; i < 366 && metersOn(d, kidId, dateKey(day)); i++, day = plusDays(day, -1)) n++;
    return n;
  }

  /* Before kids-core tidies old log days away, bank their meters on the child.
     upTo makes this safe to run on several devices: a day is banked once. */
  function fold(d, today, logDays = 120) {
    const cutoff = dateKey(plusDays(parseDate(today), -logDays));
    for (const kid of d.kids || []) {
      const c = kid.climb || {};
      const days = Object.keys(d.log || {}).filter(day => day < cutoff && (!c.upTo || day > c.upTo));
      if (!days.length) continue;
      const cl = climbOf(kid);
      cl.bank = (Number(cl.bank) || 0) + days.reduce((n, day) => n + metersOn(d, kid.id, day), 0);
      cl.upTo = days.sort()[days.length - 1];
    }
    return d;
  }

  /* Visualization: one session a day counts. */
  const vizDone = (d, kidId, day) => !!d.log?.[day]?.[vizId(kidId)];
  function finishViz(d, kid, day, { now = new Date() } = {}) {
    if (vizDone(d, kid.id, day)) return false;
    if (!d.log || typeof d.log !== 'object') d.log = {};
    (d.log[day] ||= {})[vizId(kid.id)] = { kidId: kid.id, viz: true, stars: 0, ok: false, at: now.toISOString() };
    const c = climbOf(kid); c.viz = (Number(c.viz) || 0) + 1;
    return true;
  }

  /* Big dream ---------------------------------------------------------- */
  function setDream(kid, { text, why, steps }, makeId) {
    const old = kid.dream?.steps || [];
    kid.dream = {
      text: String(text || '').trim().slice(0, 90),
      why: String(why || '').trim().slice(0, 200),
      steps: (steps || []).map(s => ({ id: s.id || makeId(), title: String(s.title || '').trim().slice(0, 60), done: !!(s.done ?? old.find(o => o.id === s.id)?.done) }))
        .filter(s => s.title).slice(0, MAX_STEPS)
    };
    if (!kid.dream.text && !kid.dream.steps.length) delete kid.dream;
    return kid.dream || null;
  }
  function toggleDreamStep(kid, stepId) {
    const s = kid.dream?.steps?.find(x => x.id === stepId); if (!s) return null;
    s.done = !s.done;
    return s.done;
  }

  /* Lessons ------------------------------------------------------------ */
  function addLesson(kid, oops, learn, day, id) {
    oops = String(oops || '').trim().slice(0, 100); learn = String(learn || '').trim().slice(0, 120);
    if (!oops || !learn) return null;
    const l = { id, day, oops, learn };
    kid.lessons = [...(Array.isArray(kid.lessons) ? kid.lessons : []), l].slice(-MAX_LESSONS);
    return l;
  }

  /* Medals stay once earned, even if a streak later breaks. */
  const MEDALS = [
    { id: 'first', emoji: '🥾', title: 'First climb', test: s => s.total > 0 },
    { id: 'streak3', emoji: '🔥', title: '3 days in a row', test: s => s.streak >= 3 },
    { id: 'streak7', emoji: '⚡', title: '7 days in a row', test: s => s.streak >= 7 },
    { id: 'summit1', emoji: '🏔️', title: 'First summit', test: s => s.total >= PEAK },
    { id: 'summit5', emoji: '🏆', title: '5 summits', test: s => s.total >= PEAK * 5 },
    { id: 'dreamer', emoji: '🎯', title: 'Dream step done', test: s => s.dreamSteps > 0 },
    { id: 'focus', emoji: '🧘', title: '5 visualizations', test: s => s.viz >= 5 },
    { id: 'learner', emoji: '📝', title: '3 lessons learned', test: s => s.lessons >= 3 }
  ];
  /* Adds any newly earned medals to the child and returns them. */
  function awardMedals(d, kid, today) {
    const c = climbOf(kid), have = new Set(c.medals || []);
    const s = { total: total(d, kid), streak: streak(d, kid.id, today), viz: Number(c.viz) || 0,
      dreamSteps: (kid.dream?.steps || []).filter(x => x.done).length, lessons: (kid.lessons || []).length };
    const fresh = MEDALS.filter(m => !have.has(m.id) && m.test(s));
    if (fresh.length) c.medals = [...have, ...fresh.map(m => m.id)];
    return fresh;
  }
  const hasMedal = (kid, id) => (kid.climb?.medals || []).includes(id);

  /* Content --------------------------------------------------------------- */
  const THOUGHTS = ["Champions aren't born. They're built, one practice at a time.", 'Falling is part of learning to fly down the mountain.',
    'Be brave enough to be a beginner.', 'Do your best, then rest. Rest is part of training.',
    'Working hard at school and at sport is the same superpower.', "Compare yourself to yesterday's you, not to anyone else.",
    'Nervous means you care. Breathe, and go for it.', 'Small steps every day climb the biggest mountains.', 'Have fun. Joy keeps you practicing.'];
  const thoughtFor = day => THOUGHTS[Math.floor(parseDate(day).getTime() / 864e5) % THOUGHTS.length];
  const REFRAMES = [["I'm not good at this.", "I'm not good at this yet."], ['I made a mistake.', 'Mistakes help me learn.'],
    ["It's too hard.", "Hard means I'm growing."], ["They're better than me.", 'What can I learn from them?'],
    ['I give up.', "I'll try a different way."], ["I'm too scared.", 'Brave means scared and trying.']];
  const VIZ_LINES = ['Close your eyes. Breathe in slowly.', 'Breathe out. Let your shoulders relax.',
    'Picture the place where you practice your sport or skill.', 'See yourself getting ready. You feel calm and strong.',
    'Now watch yourself do it, smooth and confident.', 'Feel how proud you are. You gave your best.', 'Breathe in, and out. Open your eyes, champion.'];

  return { PEAK, CHORE, STEP, VIZ, MAX_LESSONS, MAX_STEPS, vizId, metersOn, total, position, streak, fold, vizDone, finishViz,
    setDream, toggleDreamStep, addLesson, MEDALS, awardMedals, hasMedal, THOUGHTS, thoughtFor, REFRAMES, VIZ_LINES };
});
