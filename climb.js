/* Little Days Summit Climb (Kid mode): the mountain, My big dream, Champion
   mind and medals. Uses app.js helpers (data, save, openSheet, closeSheet,
   toast, esc, kidBy, field, todayKey, uid, pref, $), kids.js (renderKidMode,
   celebrate) and climb-core.js. */
'use strict';
const CL = window.LittleDaysClimb;
const climbOn = () => data.settings?.climb !== false;
const fmtM = n => Number(n).toLocaleString();
const kidModeKid = () => kidBy(pref.get('ld_kid_mode', ''));

/* Trail the climber follows, bottom to summit, in the mountain's viewBox. */
const CL_TRAIL = [[64, 176], [128, 160], [104, 142], [166, 124], [146, 104], [196, 86], [178, 66], [210, 44]];
function trailPoint(f) {
  const seg = []; let len = 0;
  for (let i = 1; i < CL_TRAIL.length; i++) { const s = Math.hypot(CL_TRAIL[i][0] - CL_TRAIL[i - 1][0], CL_TRAIL[i][1] - CL_TRAIL[i - 1][1]); seg.push(s); len += s; }
  let t = Math.max(0, Math.min(1, f)) * len;
  for (let i = 0; i < seg.length; i++) {
    if (t <= seg[i]) { const r = t / seg[i]; return [CL_TRAIL[i][0] + (CL_TRAIL[i + 1][0] - CL_TRAIL[i][0]) * r, CL_TRAIL[i][1] + (CL_TRAIL[i + 1][1] - CL_TRAIL[i][1]) * r]; }
    t -= seg[i];
  }
  return CL_TRAIL[CL_TRAIL.length - 1];
}
/* The part of the trail already climbed, as polyline points. */
function trailDone(f) {
  const [x, y] = trailPoint(f), out = [CL_TRAIL[0]];
  for (let i = 1; i < CL_TRAIL.length && CL_TRAIL[i][1] > y; i++) out.push(CL_TRAIL[i]);   // the trail only goes up
  out.push([x, y]);
  return out.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ');
}

const MEDAL_ICON = { first: 'boot', streak3: 'flame', streak7: 'bolt', summit1: 'flag', summit5: 'trophy', dreamer: 'target', focus: 'eye', learner: 'book' };

function climbHero(k) {
  if (!climbOn()) return '';
  const today = todayKey(), m = CL.total(data, k), pos = CL.position(m), todayM = CL.metersOn(data, k.id, today);
  const [x, y] = trailPoint(pos.fraction), streak = CL.streak(data, k.id, today);
  const trail = CL_TRAIL.map(p => p.join(',')).join(' ');
  return `<section class="km-card cl-hero" aria-label="Summit climb">
    <div class="cl-hero-head"><h2>${kmIcon('mountain')}My climb</h2><span class="cl-pill">Mountain ${pos.mountain}</span></div>
    <div class="cl-scene">
      <svg viewBox="0 0 360 200" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(k.name)} is ${fmtM(pos.into)} meters up mountain ${pos.mountain}">
        <defs>
          <linearGradient id="clSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--c)"/><stop offset="1" style="stop-color:var(--surface)"/></linearGradient>
          <linearGradient id="clPeak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--c-ink);stop-opacity:.82"/><stop offset="1" style="stop-color:var(--c-ink)"/></linearGradient>
        </defs>
        <rect width="360" height="200" fill="url(#clSky)"/>
        <circle cx="300" cy="46" r="20" style="fill:var(--m3)" opacity=".9"/>
        <g fill="#fff" opacity=".75"><rect x="40" y="34" width="54" height="14" rx="7"/><rect x="56" y="26" width="26" height="14" rx="7"/><rect x="250" y="76" width="44" height="11" rx="5.5"/></g>
        <path d="M0 200V120l46-30 40 22 50-46 52 50 46-28 56 34 70-30v108z" style="fill:var(--c-ink)" opacity=".2"/>
        <path d="M18 200 104 120l24 14L210 36l92 112 58 52z" fill="url(#clPeak)"/>
        <path d="M210 36 302 148l58 52H250z" fill="#000" opacity=".12"/>
        <path d="M210 36 186 66l12-4 9 12 12-14 10 9 6-6z" fill="#fff"/>
        <path d="M104 120 94 130l9-2 6 6 7-7z" fill="#fff" opacity=".85"/>
        <path d="M0 200v-18c40-14 80-12 120-2s90 8 130-4 80-8 110 4v20z" style="fill:var(--c)"/>
        <polyline points="${trail}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.5" stroke-dasharray="1 7" stroke-linecap="round"/>
        <polyline points="${trailDone(pos.fraction)}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M210 44V18" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M211 18h17l-4 5 4 5h-17z" style="fill:var(--accent)"/>
        <circle class="cl-halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" fill="#fff" opacity=".35"/>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="#fff"/>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" style="fill:var(--accent)"/>
      </svg>
    </div>
    <div class="cl-stats">
      <div><strong>${fmtM(todayM)}<span> m</span></strong><small>Today</small></div>
      <div><strong>${streak}<span> ${streak === 1 ? 'day' : 'days'}</span></strong><small>Streak</small></div>
      <div><strong>${fmtM(m)}<span> m</span></strong><small>All time</small></div>
    </div>
    <div class="cl-progress"><span class="bar" aria-hidden="true"><span style="width:${Math.round(pos.fraction * 100)}%"></span></span>
      <div class="cl-progress-txt"><span>${fmtM(pos.into)} of ${fmtM(CL.PEAK)} m</span><span>${fmtM(pos.left)} m to the summit</span></div></div>
    <div class="cl-earn" aria-label="How to climb">
      <span>${kmIcon('check', 'cl-earn-ico')}Chore <b>+${CL.CHORE} m</b></span>
      <span>${kmIcon('flag', 'cl-earn-ico')}Routine step <b>+${CL.STEP} m</b></span>
      <span>${kmIcon('eye', 'cl-earn-ico')}Visualize <b>+${CL.VIZ} m</b></span>
    </div>
  </section>`;
}

function climbCards(k) {
  if (!climbOn()) return '';
  const today = todayKey(), dream = k.dream, viz = CL.vizDone(data, k.id, today);
  const lesson = (k.lessons || [])[(k.lessons || []).length - 1];
  const medals = CL.MEDALS.map(m => ({ ...m, got: CL.hasMedal(k, m.id) }));
  const action = (attr, icon, title, sub, done) => `<button class="cl-action${done ? ' done' : ''}" ${attr}>${kmIcon(done ? 'check' : icon, 'cl-tile')}<span><strong>${title}</strong><small>${sub}</small></span><span class="cl-chev" aria-hidden="true">›</span></button>`;
  return `<section class="km-card"><h2>${kmIcon('target')}My big dream${dream?.steps?.length ? ` <span class="km-count">${dream.steps.filter(s => s.done).length}/${dream.steps.length}</span>` : ''}</h2>
      ${dream ? `<div class="cl-dream"><span class="cl-label">My dream</span><p>${esc(dream.text || 'My dream')}</p>${dream.why ? `<small>${esc(dream.why)}</small>` : ''}</div>
        ${dream.steps.length ? `<div class="km-steps">${dream.steps.map((s, i) => `<button class="km-step${s.done ? ' on' : ''}" data-cl-step="${esc(s.id)}" aria-pressed="${s.done}"><span class="cl-num" aria-hidden="true">${i + 1}</span><span>${esc(s.title)}</span><span class="km-tick" aria-hidden="true"></span></button>`).join('')}</div>` : ''}
        <button class="cl-btn ghost" data-cl-dream>Edit my dream</button>`
      : `<div class="cl-empty"><p>What’s your big dream? Champions turn big dreams into small steps.</p><button class="cl-btn" data-cl-dream>Write my dream</button></div>`}
    </section>
    <section class="km-card"><h2>${kmIcon('brain')}Champion mind</h2>
      <figure class="cl-thought"><figcaption class="cl-label">Thought of the day</figcaption><blockquote>${esc(CL.thoughtFor(today))}</blockquote></figure>
      <div class="cl-actions">
        ${action('data-cl-viz', 'eye', 'Picture my goal', viz ? 'Done today. Great focus!' : `1 minute · +${CL.VIZ} m`, viz)}
        ${action('data-cl-reframe', 'flip', 'Flip a stuck thought', 'Swap “I can’t” for a champion thought')}
        ${action('data-cl-lesson', 'bulb', 'Oops into a lesson', lesson ? `Last: ${esc(lesson.learn)}` : 'Everyone falls. What did you learn?')}
      </div>
    </section>
    <section class="km-card"><h2>${kmIcon('medal')}My medals <span class="km-count">${medals.filter(m => m.got).length}/${medals.length}</span></h2>
      <div class="cl-medals">${medals.map(m => `<div class="cl-medal${m.got ? ' got' : ''}"><span class="cl-disc">${kmIcon(m.got ? MEDAL_ICON[m.id] : 'lock', 'cl-disc-ico')}</span><span>${esc(m.title)}</span>${m.got ? '' : '<span class="sr-only"> (not earned yet)</span>'}</div>`).join('')}</div>
    </section>`;
}

/* ---------- Sheets ---------- */
function openDreamEditor(k) {
  const d = k.dream || { text: '', why: '', steps: [] };
  const steps = d.steps.length ? d.steps : [{ id: uid(), title: '' }, { id: uid(), title: '' }];
  const row = s => `<div class="steprow cl-row" data-step="${esc(s.id)}"><input class="step-title" aria-label="Step" maxlength="60" placeholder="A small step" value="${esc(s.title)}"><button type="button" class="icon-btn" data-remove aria-label="Remove step">✕</button></div>`;
  openSheet(`<form id="clForm" novalidate><h2 id="sheetTitle">My big dream</h2>
    ${field('My dream', 'clText', `<input id="clText" name="text" maxlength="90" placeholder="Win a medal at my ski race" value="${esc(d.text)}">`)}
    ${field('Why it matters to me', 'clWhy', `<input id="clWhy" name="why" maxlength="200" placeholder="I love going fast" value="${esc(d.why)}">`)}
    <div class="field"><span class="label">Steps to get there</span><div id="clSteps">${steps.map(row).join('')}</div><button type="button" class="btn small" id="clAdd">Add step</button></div>
    <div class="sheet-actions"><span></span><div class="end"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Save</button></div></div></form>`);
  const form = $('clForm'), list = $('clSteps');
  const bind = () => list.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => b.closest('.steprow').remove());
  bind();
  $('clAdd').onclick = () => {
    if (list.children.length >= CL.MAX_STEPS) return toast(`Up to ${CL.MAX_STEPS} steps. Finish some first!`);
    list.insertAdjacentHTML('beforeend', row({ id: uid(), title: '' })); bind(); list.lastElementChild.querySelector('input').focus();
  };
  form.querySelector('[data-close]').onclick = closeSheet;
  form.onsubmit = ev => {
    ev.preventDefault();
    const stepsIn = [...list.querySelectorAll('.steprow')].map(r => ({ id: r.dataset.step, title: r.querySelector('input').value }));
    CL.setDream(k, { text: form.text.value, why: form.why.value, steps: stepsIn }, uid);
    save(); closeSheet(); renderKidMode(); toast(k.dream ? 'Dream saved 🎯' : 'Dream cleared');
  };
}

let clVizTimer = null;
function openVizCoach(k) {
  const RING = 2 * Math.PI * 70;
  openSheet(`<div class="cl-coach"><h2 id="sheetTitle">Picture my goal</h2>
    <p class="sub">Athletes picture their best performance before they do it. Find a comfy spot.</p>
    <div class="cl-orb" id="clOrb"><svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="70" fill="none" stroke="var(--line)" stroke-width="6"/>
      <circle id="clArc" cx="80" cy="80" r="70" fill="none" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${RING}" stroke-dashoffset="${RING}" transform="rotate(-90 80 80)"/></svg>
      <span id="clOrbTxt">60</span></div>
    <p class="cl-line" id="clLine" aria-live="polite">Press start, then close your eyes and listen to a grown-up read along, or peek at the words.</p>
    <div class="sheet-actions"><span></span><div class="end"><button class="btn" data-close>Close</button><button class="btn primary" id="clGo">Start</button></div></div></div>`);
  const sheet = $('sheet');
  const stop = () => { clearInterval(clVizTimer); clVizTimer = null; };
  sheet.querySelector('[data-close]').onclick = () => { stop(); closeSheet(); };
  $('clGo').onclick = () => {
    if (clVizTimer) return;
    $('clGo').disabled = true;
    let s = 0;
    const tick = () => {
      if (!$('clOrb')) return stop();           // sheet closed another way
      $('clLine').textContent = CL.VIZ_LINES[Math.min(Math.floor(s / 9), CL.VIZ_LINES.length - 1)];
      const inhale = s % 8 < 4;
      $('clOrb').classList.toggle('in', inhale);
      $('clOrbTxt').textContent = inhale ? 'Breathe in' : 'Breathe out';
      $('clArc').setAttribute('stroke-dashoffset', RING * (1 - s / 60));
      if (s >= 60) {
        stop();
        const first = CL.finishViz(data, k, todayKey());
        save(); closeSheet(); renderKidMode(); afterClimb(k);
        celebrate(first ? `Great focus! +${CL.VIZ} m` : 'Great focus!');
        return;
      }
      s++;
    };
    tick(); clVizTimer = setInterval(tick, 1000);
  };
}

function openReframes() {
  openSheet(`<h2 id="sheetTitle">Flip a stuck thought</h2><p class="sub">Tap a stuck thought to turn it into a champion thought.</p>
    <div class="cl-flips">${CL.REFRAMES.map(([a, b], i) => `<button class="cl-flip" data-flip="${i}" aria-expanded="false"><span class="from">${esc(a)}</span><span class="to">${esc(b)}</span></button>`).join('')}</div>
    <div class="sheet-actions"><span></span><div class="end"><button class="btn primary" data-close>Done</button></div></div>`);
  const sheet = $('sheet');
  sheet.querySelector('[data-close]').onclick = closeSheet;
  sheet.querySelectorAll('.cl-flip').forEach(b => b.onclick = () => { b.setAttribute('aria-expanded', b.getAttribute('aria-expanded') !== 'true'); window.littleDaysNative?.tap?.(); });
}

function openLesson(k) {
  const list = (k.lessons || []).slice(-3).reverse();
  openSheet(`<form id="clForm" novalidate><h2 id="sheetTitle">Oops into a lesson</h2><p class="sub">Every champion falls, on the snow and at school. What counts is what you learn.</p>
    ${field('What went wrong?', 'clOops', '<input id="clOops" name="oops" maxlength="100" placeholder="I fell on my last run">')}
    ${field('What did I learn?', 'clLearn', '<input id="clLearn" name="learn" maxlength="120" placeholder="Bend my knees and look ahead">')}
    <p class="cloud-msg error" id="formError" role="alert"></p>
    ${list.length ? `<div class="field"><span class="label">My lessons</span>${list.map(l => `<div class="cl-lesson"><small>${esc(l.oops)}</small><strong>${esc(l.learn)}</strong></div>`).join('')}</div>` : ''}
    <div class="sheet-actions"><span></span><div class="end"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Save lesson</button></div></div></form>`);
  const form = $('clForm');
  form.querySelector('[data-close]').onclick = closeSheet;
  form.onsubmit = ev => {
    ev.preventDefault();
    if (!CL.addLesson(k, form.oops.value, form.learn.value, todayKey(), uid())) { $('formError').textContent = 'Fill in both boxes.'; return; }
    save(); closeSheet(); renderKidMode(); afterClimb(k); celebrate('Lesson learned 💡');
  };
}

/* Medals and summits after anything a child does in Kid mode. */
let clBefore = null;
function afterClimb(k) {
  if (!k || !climbOn()) return;
  const fresh = CL.awardMedals(data, k, todayKey());
  const summits = CL.position(CL.total(data, k)).summits;
  if (fresh.length) { save(); renderKidMode(); }
  if (clBefore && clBefore.id === k.id && summits > clBefore.summits) setTimeout(() => celebrate(`🏔️ Summit reached! On to mountain ${summits + 1}`), 400);
  else if (fresh.length) setTimeout(() => celebrate(`New medal: ${fresh[0].emoji} ${fresh[0].title}`), 400);
  clBefore = { id: k.id, summits };
}

document.addEventListener('click', ev => {   // capture: remember where the climber was
  if (!ev.target.closest?.('#kidMode')) return;
  const k = kidModeKid(); if (k) clBefore = { id: k.id, summits: CL.position(CL.total(data, k)).summits };
}, true);
document.addEventListener('click', ev => {   // after kids.js has handled the tap
  const t = ev.target.closest?.('[data-cl-dream],[data-cl-step],[data-cl-viz],[data-cl-reframe],[data-cl-lesson],[data-km-step],[data-km-chore]');
  if (!t) return;
  const k = kidModeKid(); if (!k) return;
  const d = t.dataset;
  if ('clDream' in d) return openDreamEditor(k);
  if (d.clStep) {
    const done = CL.toggleDreamStep(k, d.clStep); if (done == null) return;
    save(); renderKidMode(); afterClimb(k);
    if (done) celebrate('Step done! Closer to your dream 🎯');
    return;
  }
  if ('clViz' in d) return CL.vizDone(data, k.id, todayKey()) ? toast('Already done today. Come back tomorrow!') : openVizCoach(k);
  if ('clReframe' in d) return openReframes();
  if ('clLesson' in d) return openLesson(k);
  afterClimb(k);                               // a chore or routine step
});

/* kids.js drew Kid mode before this file loaded; draw it again with the climb. */
if (inKidMode()) renderKidMode();
