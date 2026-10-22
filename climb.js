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
const CL_TRAIL = [[46, 150], [112, 136], [86, 118], [152, 104], [130, 86], [190, 70], [170, 52], [206, 32]];
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

function climbHero(k) {
  if (!climbOn()) return '';
  const today = todayKey(), m = CL.total(data, k), pos = CL.position(m), todayM = CL.metersOn(data, k.id, today);
  const [x, y] = trailPoint(pos.fraction), streak = CL.streak(data, k.id, today);
  const pts = CL_TRAIL.map(p => p.join(',')).join(' ');
  return `<section class="km-card cl-hero" aria-label="Summit climb">
    <div class="cl-top"><h2>⛰️ My climb</h2><span class="km-count">Mountain ${pos.mountain}${streak > 1 ? ` · 🔥 ${streak} days` : ''}</span></div>
    <svg class="cl-mtn" viewBox="0 0 360 170" role="img" aria-label="${esc(k.name)} is ${fmtM(pos.into)} meters up mountain ${pos.mountain}">
      <rect width="360" height="170" fill="var(--surface-2)"/>
      <circle cx="304" cy="40" r="15" fill="var(--c)" opacity=".7"/>
      <polygon points="0,170 0,104 56,78 104,100 158,60 214,92 262,70 312,94 360,76 360,170" fill="var(--c)" opacity=".45"/>
      <polygon points="0,170 36,138 98,100 132,116 206,22 262,108 300,94 360,126 360,170" fill="var(--c)"/>
      <polygon points="206,22 184,54 196,50 204,62 216,48 232,54" fill="var(--surface)"/>
      <polygon points="98,100 88,112 100,109 108,116 114,110" fill="var(--surface)" opacity=".85"/>
      <polyline points="${pts}" fill="none" stroke="var(--c-ink)" stroke-opacity=".35" stroke-width="3" stroke-dasharray="1 8" stroke-linecap="round"/>
      <line x1="206" y1="32" x2="206" y2="8" stroke="var(--c-ink)" stroke-width="2.5"/>
      <polygon points="206,8 224,13 206,18" fill="var(--accent)"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" fill="var(--c-ink)" opacity=".18"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="var(--c-ink)" stroke="var(--surface)" stroke-width="3"/>
    </svg>
    <div class="cl-meter"><div><strong>${fmtM(todayM)} m</strong><small>today</small></div><div><strong>${fmtM(pos.left)} m</strong><small>to the top</small></div><div><strong>${fmtM(m)} m</strong><small>all time</small></div></div>
    <span class="bar" aria-hidden="true"><span style="width:${Math.round(pos.fraction * 100)}%"></span></span>
    <p class="cl-how">Every chore +${CL.CHORE} m · every routine step +${CL.STEP} m · picture your goal +${CL.VIZ} m</p>
  </section>`;
}

function climbCards(k) {
  if (!climbOn()) return '';
  const today = todayKey(), dream = k.dream, viz = CL.vizDone(data, k.id, today);
  const lesson = (k.lessons || [])[(k.lessons || []).length - 1];
  const medals = CL.MEDALS.map(m => ({ ...m, got: CL.hasMedal(k, m.id) }));
  return `<section class="km-card"><h2>🎯 My big dream${dream?.steps?.length ? ` <span class="km-count">${dream.steps.filter(s => s.done).length}/${dream.steps.length}</span>` : ''}</h2>
      ${dream ? `<p class="cl-dream">${esc(dream.text || 'My dream')}</p>${dream.why ? `<p class="cl-why">${esc(dream.why)}</p>` : ''}
        ${dream.steps.length ? `<div class="km-steps">${dream.steps.map(s => `<button class="km-step${s.done ? ' on' : ''}" data-cl-step="${esc(s.id)}" aria-pressed="${s.done}"><span class="km-emoji">🪜</span><span>${esc(s.title)}</span><span class="km-tick" aria-hidden="true"></span></button>`).join('')}</div>` : ''}
        <button class="km-exit cl-edit" data-cl-dream>Change my dream</button>`
      : `<p class="km-empty">What's your big dream? Champions turn big dreams into small steps.</p><button class="cl-btn" data-cl-dream>Write my dream</button>`}
    </section>
    <section class="km-card"><h2>🧠 Champion mind</h2>
      <p class="cl-thought">“${esc(CL.thoughtFor(today))}”</p>
      <div class="cl-actions">
        <button class="cl-action${viz ? ' done' : ''}" data-cl-viz><span class="km-emoji">${viz ? '✅' : '👀'}</span><span><strong>Picture my goal</strong><small>${viz ? 'Done today. Great focus!' : `1 minute · +${CL.VIZ} m`}</small></span></button>
        <button class="cl-action" data-cl-reframe><span class="km-emoji">🔄</span><span><strong>Flip a stuck thought</strong><small>Swap “I can't” for a champion thought</small></span></button>
        <button class="cl-action" data-cl-lesson><span class="km-emoji">💡</span><span><strong>Oops into a lesson</strong><small>${lesson ? `Last: ${esc(lesson.learn)}` : 'Everyone falls. What did you learn?'}</small></span></button>
      </div>
    </section>
    <section class="km-card"><h2>🏅 My medals <span class="km-count">${medals.filter(m => m.got).length}/${medals.length}</span></h2>
      <div class="cl-medals">${medals.map(m => `<div class="cl-medal${m.got ? ' got' : ''}"><span aria-hidden="true">${m.emoji}</span>${esc(m.title)}${m.got ? '' : '<span class="sr-only"> (not yet)</span>'}</div>`).join('')}</div>
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
