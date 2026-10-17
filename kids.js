/* Little Days for kids: chores, routines, stars, rewards and Kid mode.
   Uses app.js helpers (data, save, render, openSheet, closeSheet, toast, esc,
   avatar, colorClass, kidBy, field, todayKey, uid, pref, $) and kids-core.js. */
'use strict';
const K = window.LittleDaysKids;
const STAR = '⭐';
const starsOn = () => data.settings?.stars !== false;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ---------- Celebration ---------- */
function celebrate(text) {
  if (text) toast(text);
  window.littleDaysNative?.success?.();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.className = 'confetti'; layer.setAttribute('aria-hidden', 'true');
  const colors = ['var(--m0)', 'var(--m1)', 'var(--m2)', 'var(--m3)', 'var(--m4)', 'var(--m5)', 'var(--accent)'];
  for (let i = 0; i < 36; i++) {
    const p = document.createElement('i');
    const angle = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 220;
    p.style.cssText = `--x:${Math.cos(angle) * dist}px;--y:${Math.sin(angle) * dist - 120}px;--r:${Math.random() * 720 - 360}deg;background:${colors[i % colors.length]};animation-delay:${Math.random() * 80}ms`;
    if (i % 4 === 0) { p.textContent = STAR; p.style.background = 'none'; }
    layer.append(p);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 1400);
}

/* ---------- Parent: Today card ---------- */
function renderKidsToday() {
  const card = $('choresCard'); if (!card) return;
  K.ensure(data);
  const today = todayKey();
  const kids = data.kids.filter(k => filter === 'all' || filter === k.id);
  const any = data.chores.length || data.routines.length;
  const waiting = K.pending(data).filter(p => filter === 'all' || p.kidId === filter);
  if (!any && !waiting.length) {
    card.innerHTML = `<h2>Chores & routines</h2><p class="empty">Give the kids a few chores or a morning routine. They can tick them off themselves in Kid mode.</p><div class="row-actions"><button class="btn small" data-k-add="chore">Add a chore</button><button class="btn small" data-k-add="routine">Add a routine</button></div>`;
    return;
  }
  let html = `<div class="card-head"><h2>Chores & routines</h2><button class="link-btn" data-k-kidmode>Kid mode</button></div>`;
  if (waiting.length) html += `<div class="waiting"><p class="day-label">Waiting for you</p>${waiting.map(pendingRow).join('')}</div>`;
  html += kids.map(k => {
    const p = K.dayProgress(data, k.id, today), routines = K.routinesFor(data, k.id);
    if (!p.due && !routines.length) return '';
    const doneRoutines = routines.filter(r => K.routineDone(data, r, today)).length;
    const pct = p.due ? Math.round(p.done / p.due * 100) : 0;
    const streak = K.streak(data, k.id, today);
    return `<button class="kidrow ${colorClass(k)}" data-k-open="${esc(k.id)}" aria-label="${esc(k.name)}: ${p.done} of ${p.due} chores done. Open">
      ${avatar(k)}
      <span class="kr-main"><strong>${esc(k.name)}</strong>
        <span class="bar" aria-hidden="true"><span style="width:${pct}%"></span></span>
        <small>${p.due ? `${p.done}/${p.due} chores` : 'No chores today'}${routines.length ? ` · ${doneRoutines}/${routines.length} routines` : ''}${streak > 1 ? ` · 🔥 ${streak} days` : ''}</small></span>
      ${starsOn() ? `<span class="stars">${STAR} ${K.balance(data, k.id)}</span>` : ''}
    </button>`;
  }).join('');
  card.innerHTML = html;
}

function pendingRow(p) {
  const k = kidBy(p.kidId);
  if (p.type === 'chore') return `<div class="pending ${colorClass(k)}">${avatar(k, 36)}<span><strong>${esc(p.chore.emoji || '✅')} ${esc(p.chore.title)}</strong><small>${esc(k?.name || '')} says it's done${p.day !== todayKey() ? ' · ' + esc(parseDate(p.day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })) : ''}</small></span>
    <button class="btn small" data-k-reopen="${esc(p.chore.id)}|${p.day}">Not yet</button><button class="btn small primary" data-k-approve="${esc(p.chore.id)}|${p.day}">Approve</button></div>`;
  const r = p.redemption;
  return `<div class="pending ${colorClass(k)}">${avatar(k, 36)}<span><strong>${esc(r.emoji || '🎁')} ${esc(r.title)}</strong><small>${esc(k?.name || '')} would like this · ${STAR} ${r.cost}</small></span>
    <button class="btn small" data-k-decline="${esc(r.id)}">Not now</button><button class="btn small primary" data-k-give="${esc(r.id)}">Give it</button></div>`;
}

/* ---------- Parent: Family page ---------- */
function renderKidsFamily() {
  const box = $('kidsAdmin'); if (!box) return;
  K.ensure(data);
  const today = todayKey();
  // Stars and streaks on the child cards
  document.querySelectorAll('.member[data-kid]').forEach(card => {
    const k = kidBy(card.dataset.kid); if (!k) return;
    const chips = card.querySelector('.chips');
    if (starsOn()) chips.insertAdjacentHTML('beforeend', `<span class="chip">${STAR} ${K.balance(data, k.id)}</span>`);
    const s = K.streak(data, k.id, today); if (s > 1) chips.insertAdjacentHTML('beforeend', `<span class="chip">🔥 ${s}</span>`);
  });
  const waiting = K.pending(data);
  const byKid = (list, fmt) => data.kids.map(k => {
    const items = list.filter(x => x.kidId === k.id);
    return items.length ? `<p class="day-label">${esc(k.name)}</p>${items.map(fmt).join('')}` : '';
  }).join('');
  const daysText = c => !c.days?.length ? 'Every day' : c.days.length === 5 && c.days.join() === '1,2,3,4,5' ? 'Weekdays' : c.days.map(d => core.weekdayNames[d].slice(0, 3)).join(', ');
  box.innerHTML = `
    ${waiting.length ? `<section class="card"><h2>Waiting for you</h2>${waiting.map(pendingRow).join('')}</section>` : ''}
    <section class="card"><div class="card-head"><h2>Chores</h2><button class="link-btn" data-k-add="chore">Add chore</button></div>
      ${data.chores.length ? byKid(data.chores, c => `<button class="adminrow" data-k-edit="chore|${esc(c.id)}"><span class="ar-emoji">${esc(c.emoji || '✅')}</span><span><strong>${esc(c.title)}</strong><small>${esc(daysText(c))}${starsOn() ? ` · ${STAR} ${Number(c.stars) || 0}` : ''}${c.approval ? ' · grown-up checks' : ''}</small></span></button>`)
        : '<p class="empty">No chores yet. Add one, or pick from ideas that fit each child’s age.</p>'}
    </section>
    <section class="card"><div class="card-head"><h2>Routines</h2><button class="link-btn" data-k-add="routine">Add routine</button></div>
      ${data.routines.length ? byKid(data.routines, r => `<button class="adminrow" data-k-edit="routine|${esc(r.id)}"><span class="ar-emoji">${esc(r.emoji || '📋')}</span><span><strong>${esc(r.name)}</strong><small>${plural(r.steps?.length || 0, 'step', 'steps')}${starsOn() ? ` · ${STAR} ${Number(r.stars) || 0} when finished` : ''}</small></span></button>`)
        : '<p class="empty">Morning, after-school and bedtime routines help kids know what comes next.</p>'}
    </section>
    ${starsOn() ? `<section class="card"><div class="card-head"><h2>Rewards</h2><button class="link-btn" data-k-add="reward">Add reward</button></div>
      ${data.rewards.length ? data.rewards.map(r => `<button class="adminrow" data-k-edit="reward|${esc(r.id)}"><span class="ar-emoji">${esc(r.emoji || '🎁')}</span><span><strong>${esc(r.title)}</strong><small>${STAR} ${Number(r.cost) || 0}</small></span></button>`).join('')
        : '<p class="empty">Rewards are things kids can save their stars for, like picking dinner or a trip to the park. You decide when they’re given.</p>'}
    </section>` : ''}
    <div class="row-actions"><button class="btn primary" data-k-kidmode>Start Kid mode</button></div>`;
}

/* ---------- Editors ---------- */
const CHORE_EMOJIS = ['✅', '🛏️', '🪥', '🧸', '🐶', '🍽️', '📚', '🎒', '🧹', '🎹', '✏️', '👕', '🗑️', '🪴', '🍴', '🧺'];
function kidChecks(selected, multi) {
  return `<div class="swatches kidpick" role="${multi ? 'group' : 'radiogroup'}" aria-labelledby="kidLbl">${data.kids.map(k =>
    `<label class="${colorClass(k)}"><input type="${multi ? 'checkbox' : 'radio'}" name="kidIds" value="${esc(k.id)}"${selected.includes(k.id) ? ' checked' : ''}><span>${esc(k.emoji)}</span><em>${esc(k.name)}</em></label>`).join('')}</div>`;
}
function starPicker(name, value, max = 5) {
  return `<div class="starpick" role="radiogroup" aria-label="Stars">${Array.from({ length: max + 1 }, (_, n) =>
    `<label><input type="radio" name="${name}" value="${n}"${n === value ? ' checked' : ''}><span>${n === 0 ? 'None' : n}</span></label>`).join('')}</div>`;
}

function openChoreEditor(id) {
  const o = id ? data.chores.find(c => c.id === id) : null;
  if (!data.kids.length) return toast('Add a child first.');
  const selected = o ? [o.kidId] : (filter !== 'all' ? [filter] : [data.kids[0].id]);
  const ages = selected.map(kid => K.ageOn(kidBy(kid)?.birthday, todayKey())).filter(a => a != null);
  const ideas = K.ideasFor(ages.length ? Math.min(...ages) : null).filter(i => !data.chores.some(c => c.title === i.title && selected.includes(c.kidId))).slice(0, 10);
  openSheet(`<form id="kForm" novalidate><h2 id="sheetTitle">${o ? 'Edit chore' : 'New chore'}</h2>
    ${!o && ideas.length ? `<div class="field"><span class="label">Ideas${ages.length ? ` for age ${Math.min(...ages)}` : ''}</span><div class="ideas">${ideas.map(i => `<button type="button" class="idea" data-title="${esc(i.title)}" data-emoji="${esc(i.emoji)}">${i.emoji} ${esc(i.title)}</button>`).join('')}</div></div>` : ''}
    ${field('Chore', 'kTitle', `<input id="kTitle" name="title" maxlength="60" required placeholder="Make bed" value="${esc(o?.title)}" autofocus>`)}
    <div class="field"><span class="label" id="emojiLbl">Picture</span><div class="swatches emoji-pick" role="radiogroup" aria-labelledby="emojiLbl">${CHORE_EMOJIS.map(e => `<label><input type="radio" name="emoji" value="${e}"${e === (o?.emoji || '✅') ? ' checked' : ''} aria-label="${e}"><span>${e}</span></label>`).join('')}</div></div>
    <div class="field"><span class="label" id="kidLbl">${o ? 'Who' : 'Who (pick one or more)'}</span>${kidChecks(selected, !o)}</div>
    <div class="field"><span class="label" id="daysLbl">Which days</span><div class="daypick" role="group" aria-labelledby="daysLbl">${core.weekdayNames.map((n, i) => `<label><input type="checkbox" name="days" value="${i}"${o?.days?.includes(i) ? ' checked' : ''} aria-label="${n}"><span>${n.slice(0, 2)}</span></label>`).join('')}</div><p class="note">Leave all off for every day.</p></div>
    ${starsOn() ? `<div class="field"><span class="label">Stars earned</span>${starPicker('stars', o ? Number(o.stars) || 0 : 1)}</div>` : ''}
    <div class="field"><label class="switch"><input type="checkbox" name="approval"${o?.approval ? ' checked' : ''}><span>A grown-up checks it before it counts</span></label></div>
    <p class="cloud-msg error" id="formError" role="alert"></p>
    <div class="sheet-actions">${o ? '<button type="button" class="btn danger" id="kDel">Delete</button>' : '<span></span>'}<div class="end"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Save</button></div></div></form>`);
  const form = $('kForm');
  form.querySelectorAll('.idea').forEach(b => b.onclick = () => {
    form.title.value = b.dataset.title;
    const r = form.querySelector(`input[name=emoji][value="${b.dataset.emoji}"]`); if (r) r.checked = true;
  });
  form.querySelector('[data-close]').onclick = closeSheet;
  form.onsubmit = ev => {
    ev.preventDefault();
    const fd = new FormData(form), title = (fd.get('title') || '').trim(), kidIds = fd.getAll('kidIds');
    if (!title) { $('formError').textContent = 'Give the chore a name.'; return form.title.focus(); }
    if (!kidIds.length) { $('formError').textContent = 'Pick at least one child.'; return; }
    const fields = { title, emoji: fd.get('emoji') || '✅', days: fd.getAll('days').map(Number), stars: Number(fd.get('stars') ?? o?.stars ?? 1), approval: !!fd.get('approval') };
    if (o) Object.assign(o, fields, { kidId: kidIds[0] });
    else kidIds.forEach(kidId => data.chores.push({ id: uid(), kidId, ...fields }));
    save(); closeSheet(); render(); toast(o ? 'Saved' : kidIds.length > 1 ? `Chore added for ${kidIds.length} kids` : 'Chore added');
  };
  if (o) $('kDel').onclick = () => { if (!confirm(`Delete “${o.title}”? Stars already earned stay.`)) return; data.chores = data.chores.filter(c => c.id !== id); save(); closeSheet(); render(); toast('Deleted'); };
}

function openRoutineEditor(id, template) {
  const o = id ? data.routines.find(r => r.id === id) : null;
  if (!data.kids.length) return toast('Add a child first.');
  if (!o && template == null) {
    openSheet(`<h2 id="sheetTitle">New routine</h2><div class="quick">${K.ROUTINE_TEMPLATES.map((t, i) => `<button class="c${[3, 1, 4][i]}" data-tpl="${i}"><span class="q-icon" aria-hidden="true">${t.emoji}</span><span>${esc(t.name)}<small>${esc(t.steps.map(s => s[0]).join(', '))}</small></span></button>`).join('')}
      <button class="c2" data-tpl="-1"><span class="q-icon" aria-hidden="true">📋</span><span>Start from scratch<small>Add your own steps</small></span></button></div>
      <div class="sheet-actions"><span></span><div class="end"><button class="btn" data-close>Cancel</button></div></div>`);
    $('sheet').querySelector('[data-close]').onclick = closeSheet;
    $('sheet').querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => openRoutineEditor(null, Number(b.dataset.tpl)));
    return;
  }
  const tpl = template >= 0 ? K.ROUTINE_TEMPLATES[template] : null;
  const steps = o ? o.steps.map(s => ({ ...s })) : tpl ? tpl.steps.map(([title, emoji]) => ({ id: uid(), title, emoji })) : [{ id: uid(), title: '', emoji: '⭐' }];
  const selected = o ? [o.kidId] : (filter !== 'all' ? [filter] : [data.kids[0].id]);
  const stepRow = s => `<div class="steprow" data-step="${esc(s.id)}"><input class="step-emoji" aria-label="Step picture" maxlength="4" value="${esc(s.emoji || '⭐')}"><input class="step-title" aria-label="Step" maxlength="40" placeholder="Step" value="${esc(s.title)}">
    <button type="button" class="icon-btn" data-up aria-label="Move up">↑</button><button type="button" class="icon-btn" data-remove aria-label="Remove step">✕</button></div>`;
  openSheet(`<form id="kForm" novalidate><h2 id="sheetTitle">${o ? 'Edit routine' : 'New routine'}</h2>
    <div class="two">${field('Name', 'kName', `<input id="kName" name="name" maxlength="30" required placeholder="Morning" value="${esc(o?.name || tpl?.name || '')}">`)}
      ${field('Picture', 'kEmoji', `<input id="kEmoji" name="emoji" maxlength="4" value="${esc(o?.emoji || tpl?.emoji || '📋')}">`)}</div>
    <div class="field"><span class="label" id="kidLbl">${o ? 'Who' : 'Who (pick one or more)'}</span>${kidChecks(selected, !o)}</div>
    <div class="field"><span class="label">Steps</span><div id="steps">${steps.map(stepRow).join('')}</div><button type="button" class="btn small" id="addStep">Add step</button></div>
    ${starsOn() ? `<div class="field"><span class="label">Stars for finishing</span>${starPicker('stars', o ? Number(o.stars) || 0 : 2)}</div>` : ''}
    <p class="cloud-msg error" id="formError" role="alert"></p>
    <div class="sheet-actions">${o ? '<button type="button" class="btn danger" id="kDel">Delete</button>' : '<span></span>'}<div class="end"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Save</button></div></div></form>`);
  const form = $('kForm'), list = $('steps');
  const bindSteps = () => list.querySelectorAll('.steprow').forEach(row => {
    row.querySelector('[data-remove]').onclick = () => { if (list.children.length > 1) row.remove(); };
    row.querySelector('[data-up]').onclick = () => { if (row.previousElementSibling) list.insertBefore(row, row.previousElementSibling); };
  });
  bindSteps();
  $('addStep').onclick = () => { list.insertAdjacentHTML('beforeend', stepRow({ id: uid(), title: '', emoji: '⭐' })); bindSteps(); list.lastElementChild.querySelector('.step-title').focus(); };
  form.querySelector('[data-close]').onclick = closeSheet;
  form.onsubmit = ev => {
    ev.preventDefault();
    const fd = new FormData(form), name = (fd.get('name') || '').trim(), kidIds = fd.getAll('kidIds');
    const newSteps = [...list.querySelectorAll('.steprow')].map(r => ({ id: r.dataset.step, title: r.querySelector('.step-title').value.trim(), emoji: r.querySelector('.step-emoji').value.trim() || '⭐' })).filter(s => s.title);
    if (!name) { $('formError').textContent = 'Give the routine a name.'; return form.name.focus(); }
    if (!kidIds.length) { $('formError').textContent = 'Pick at least one child.'; return; }
    if (!newSteps.length) { $('formError').textContent = 'Add at least one step.'; return; }
    const fields = { name, emoji: fd.get('emoji') || '📋', stars: Number(fd.get('stars') ?? o?.stars ?? 2) };
    if (o) Object.assign(o, fields, { kidId: kidIds[0], steps: newSteps });
    else kidIds.forEach((kidId, i) => data.routines.push({ id: uid(), kidId, ...fields, steps: i ? newSteps.map(s => ({ ...s, id: uid() })) : newSteps }));
    save(); closeSheet(); render(); toast(o ? 'Saved' : 'Routine added');
  };
  if (o) $('kDel').onclick = () => { if (!confirm(`Delete the ${o.name} routine?`)) return; data.routines = data.routines.filter(r => r.id !== id); save(); closeSheet(); render(); toast('Deleted'); };
}

const REWARD_EMOJIS = ['🎁', '🍦', '🎬', '🛝', '🍕', '🎮', '📚', '🧁', '🎨', '🏊', '⏰', '🧸'];
function openRewardEditor(id) {
  const o = id ? data.rewards.find(r => r.id === id) : null;
  openSheet(`<form id="kForm" novalidate><h2 id="sheetTitle">${o ? 'Edit reward' : 'New reward'}</h2>
    ${field('Reward', 'kTitle', `<input id="kTitle" name="title" maxlength="50" required placeholder="Pick a movie for family night" value="${esc(o?.title)}" autofocus>`)}
    <div class="field"><span class="label" id="emojiLbl">Picture</span><div class="swatches emoji-pick" role="radiogroup" aria-labelledby="emojiLbl">${REWARD_EMOJIS.map(e => `<label><input type="radio" name="emoji" value="${e}"${e === (o?.emoji || '🎁') ? ' checked' : ''} aria-label="${e}"><span>${e}</span></label>`).join('')}</div></div>
    ${field('Stars needed', 'kCost', `<input id="kCost" name="cost" type="number" inputmode="numeric" min="1" max="500" value="${esc(o?.cost ?? 10)}">`)}
    <p class="cloud-msg error" id="formError" role="alert"></p>
    <div class="sheet-actions">${o ? '<button type="button" class="btn danger" id="kDel">Delete</button>' : '<span></span>'}<div class="end"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Save</button></div></div></form>`);
  const form = $('kForm');
  form.querySelector('[data-close]').onclick = closeSheet;
  form.onsubmit = ev => {
    ev.preventDefault();
    const fd = new FormData(form), title = (fd.get('title') || '').trim(), cost = Math.round(Number(fd.get('cost')));
    if (!title) { $('formError').textContent = 'Give the reward a name.'; return form.title.focus(); }
    if (!(cost >= 1 && cost <= 500)) { $('formError').textContent = 'Stars needed should be between 1 and 500.'; return form.cost.focus(); }
    const fields = { title, emoji: fd.get('emoji') || '🎁', cost };
    if (o) Object.assign(o, fields); else data.rewards.push({ id: uid(), ...fields });
    save(); closeSheet(); render(); toast(o ? 'Saved' : 'Reward added');
  };
  if (o) $('kDel').onclick = () => { if (!confirm(`Delete “${o.title}”?`)) return; data.rewards = data.rewards.filter(r => r.id !== id); save(); closeSheet(); render(); toast('Deleted'); };
}

/* Parent view of one child's day: tick chores on their behalf. */
function openKidDay(kidId) {
  const k = kidBy(kidId), today = todayKey(); if (!k) return;
  const chores = K.choresFor(data, kidId, today);
  openSheet(`<h2 id="sheetTitle">${esc(k.name)}'s chores today</h2>
    ${chores.length ? chores.map(c => { const st = K.choreStatus(data, c, today); return `<div class="todo ${colorClass(k)}${st !== 'todo' ? ' done' : ''}"><input type="checkbox" class="check" data-k-ptoggle="${esc(c.id)}"${st !== 'todo' ? ' checked' : ''} aria-label="${esc(c.title)}"><div class="label"><span>${esc(c.emoji || '✅')} ${esc(c.title)}</span><small>${st === 'waiting' ? 'Waiting for a grown-up' : starsOn() ? `${STAR} ${Number(c.stars) || 0}` : ''}</small></div></div>`; }).join('') : '<p class="empty">No chores today.</p>'}
    <div class="sheet-actions"><button class="btn" data-k-add="chore">Add chore</button><div class="end"><button class="btn primary" data-close>Done</button></div></div>`);
  $('sheet').querySelector('[data-close]').onclick = closeSheet;
}

/* ---------- Kid mode ---------- */
const kidModeEl = () => $('kidMode');
const inKidMode = () => pref.get('ld_kid_mode', '') !== '';
async function hashPin(pin, salt) {
  const text = salt + ':' + pin;
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0; for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0; return 'x' + h;   // very old browsers only
}
const hasPin = () => !!pref.get('ld_kid_pin', '');

function startKidMode(kidId = '') {
  if (!hasPin()) return openPinSetup(() => startKidMode(kidId));
  if (!data.kids.length) return toast('Add a child first.');
  pref.set('ld_kid_mode', kidId || (data.kids.length === 1 ? data.kids[0].id : '*'));
  closeSheet(); renderKidMode();
}
function renderKidMode() {
  const el = kidModeEl(); if (!el) return;
  const on = inKidMode();
  // Parent screens behind Kid mode can't be reached by touch, mouse or keyboard.
  document.querySelectorAll('.shell, .tabbar').forEach(x => { x.inert = on; });
  if (!on) { el.classList.add('hidden'); document.body.classList.remove('in-kidmode'); return; }
  K.ensure(data);
  el.classList.remove('hidden'); document.body.classList.add('in-kidmode');
  const who = pref.get('ld_kid_mode', '*'), k = kidBy(who);
  if (!k) {
    el.innerHTML = `<div class="km-wrap"><h1 class="km-title">Who's here?</h1><div class="km-pick">${data.kids.map(x => `<button class="km-kid ${colorClass(x)}" data-km-kid="${esc(x.id)}">${avatar(x, 120)}<span>${esc(x.name)}</span></button>`).join('')}</div>
      <button class="km-exit" data-km-exit>Grown-ups 🔒</button></div>`;
    return;
  }
  const today = todayKey(), hour = new Date().getHours();
  const routines = K.routinesFor(data, k.id);
  const suggested = hour < 11 ? 'morning' : hour < 18 ? 'after' : 'bed';
  routines.sort((a, b) => Number(b.name.toLowerCase().includes(suggested)) - Number(a.name.toLowerCase().includes(suggested)));
  const chores = K.choresFor(data, k.id, today);
  const bal = K.balance(data, k.id), avail = K.available(data, k.id), streak = K.streak(data, k.id, today);
  const asked = data.redemptions.filter(r => r.kidId === k.id && r.status === 'asked');
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Hi' : 'Good evening';
  el.innerHTML = `<div class="km-wrap ${colorClass(k)}">
    <header class="km-head">${avatar(k, 72)}<div><h1 class="km-title">${greet}, ${esc(k.name)}!</h1>
      <p class="km-sub">${starsOn() ? `<span class="km-stars" aria-label="${bal} stars">${STAR} ${bal}</span>` : ''}${streak > 1 ? `<span class="km-streak">🔥 ${streak} days in a row</span>` : ''}</p></div></header>
    ${routines.map(r => { const done = K.routineSteps(data, r, today); const finished = K.routineDone(data, r, today); return `<section class="km-card">
      <h2>${esc(r.emoji || '📋')} ${esc(r.name)}${finished ? ' <span class="km-done">All done!</span>' : ` <span class="km-count">${done.length}/${r.steps.length}</span>`}</h2>
      <div class="km-steps">${r.steps.map(s => `<button class="km-step${done.includes(s.id) ? ' on' : ''}" data-km-step="${esc(r.id)}|${esc(s.id)}" aria-pressed="${done.includes(s.id)}"><span class="km-emoji">${esc(s.emoji || '⭐')}</span><span>${esc(s.title)}</span><span class="km-tick" aria-hidden="true"></span></button>`).join('')}</div></section>`; }).join('')}
    <section class="km-card"><h2>✅ My chores</h2>
      ${chores.length ? `<div class="km-steps">${chores.map(c => { const st = K.choreStatus(data, c, today); return `<button class="km-step${st !== 'todo' ? ' on' : ''}${st === 'waiting' ? ' wait' : ''}" data-km-chore="${esc(c.id)}" aria-pressed="${st !== 'todo'}"><span class="km-emoji">${esc(c.emoji || '✅')}</span><span>${esc(c.title)}${st === 'waiting' ? '<small>A grown-up will check ✋</small>' : starsOn() && c.stars ? `<small>${STAR} ${c.stars}</small>` : ''}</span><span class="km-tick" aria-hidden="true"></span></button>`; }).join('')}</div>`
        : '<p class="km-empty">No chores today. 🎉</p>'}</section>
    ${starsOn() && data.rewards.length ? `<section class="km-card"><h2>🎁 Save up for</h2><div class="km-rewards">${data.rewards.map(r => {
      const isAsked = asked.some(a => a.rewardId === r.id), can = avail >= r.cost;
      return `<button class="km-reward${can ? ' can' : ''}" data-km-reward="${esc(r.id)}"${isAsked || !can ? ' aria-disabled="true"' : ''}><span class="km-emoji">${esc(r.emoji || '🎁')}</span><strong>${esc(r.title)}</strong>
        <span class="km-cost">${isAsked ? 'Asked ✋' : can ? `Ask for it · ${STAR} ${r.cost}` : `${STAR} ${Math.max(0, r.cost - avail)} more`}</span>
        <span class="bar" aria-hidden="true"><span style="width:${Math.min(100, Math.round(Math.max(0, avail) / r.cost * 100))}%"></span></span></button>`; }).join('')}</div></section>` : ''}
    <footer class="km-foot">${data.kids.length > 1 ? '<button class="km-exit" data-km-switch>Switch kid</button>' : ''}<button class="km-exit" data-km-exit>Grown-ups 🔒</button></footer>
  </div>`;
}

function openPinSetup(after) {
  openSheet(`<form id="pinForm" novalidate><h2 id="sheetTitle">${hasPin() ? 'Change' : 'Set'} grown-up PIN</h2>
    <p class="sub">Kid mode locks the planner so kids can only tick off their own chores and routines. You'll need this PIN to leave Kid mode on this device.</p>
    <div class="two">${field('New 4-digit PIN', 'pin1', '<input id="pin1" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[0-9]{4}" autofocus>')}
      ${field('Type it again', 'pin2', '<input id="pin2" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[0-9]{4}">')}</div>
    <p class="cloud-msg error" id="formError" role="alert"></p>
    <div class="sheet-actions"><span></span><div class="end"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Save PIN</button></div></div></form>`);
  const form = $('pinForm');
  form.querySelector('[data-close]').onclick = closeSheet;
  form.onsubmit = async ev => {
    ev.preventDefault();
    const a = $('pin1').value, b = $('pin2').value;
    if (!/^\d{4}$/.test(a)) { $('formError').textContent = 'Use exactly 4 numbers.'; return; }
    if (a !== b) { $('formError').textContent = 'The two PINs don’t match.'; return; }
    const salt = Math.random().toString(36).slice(2);
    pref.set('ld_kid_pin', salt + '$' + await hashPin(a, salt));
    closeSheet(); toast('PIN saved'); renderKidSettings(); after?.();
  };
}

let pinFails = 0, pinLockUntil = 0;
function openPinPad() {
  let entry = '';
  openSheet(`<div class="pinpad"><h2 id="sheetTitle">Grown-ups only</h2><p class="sub">Enter your PIN to leave Kid mode.</p>
    <div class="pindots" aria-live="polite" id="pinDots"></div><p class="cloud-msg error" id="formError" role="alert"></p>
    <div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(n => n === '' ? '<span></span>' : `<button class="key" data-key="${n}" aria-label="${n === '⌫' ? 'Delete' : n}">${n}</button>`).join('')}</div>
    <div class="sheet-actions"><span></span><div class="end"><button class="btn" data-close>Back to Kid mode</button></div></div></div>`);
  const dots = () => { $('pinDots').innerHTML = [0, 1, 2, 3].map(i => `<span class="${i < entry.length ? 'on' : ''}"></span>`).join(''); };
  dots();
  $('sheet').querySelector('[data-close]').onclick = closeSheet;
  $('sheet').querySelectorAll('[data-key]').forEach(b => b.onclick = async () => {
    if (Date.now() < pinLockUntil) { $('formError').textContent = 'Too many tries. Wait a minute.'; return; }
    const v = b.dataset.key;
    entry = v === '⌫' ? entry.slice(0, -1) : (entry + v).slice(0, 4); dots();
    if (entry.length < 4) return;
    const [salt, hash] = pref.get('ld_kid_pin', '$').split('$');
    if (await hashPin(entry, salt) === hash) {
      pinFails = 0; pref.set('ld_kid_mode', ''); closeSheet(); renderKidMode(); render(); toast('Welcome back');
    } else {
      pinFails++; entry = ''; dots();
      if (pinFails >= 5) { pinLockUntil = Date.now() + 60000; pinFails = 0; $('formError').textContent = 'Too many tries. Wait a minute.'; }
      else $('formError').textContent = 'That PIN isn’t right.';
    }
  });
}

/* ---------- Settings panel ---------- */
function renderKidSettings() {
  const box = $('kidSettingsMount'); if (!box) return;
  box.innerHTML = `<div class="panel"><h3>Kids</h3>
    <div class="field"><label class="switch"><input type="checkbox" id="starsToggle"${starsOn() ? ' checked' : ''}><span>Stars and rewards</span></label>
      <p class="note">Turn off to keep chores and routines without stars or a rewards shop.</p></div>
    <div class="settings-row"><button class="ghost" id="pinBtn">${hasPin() ? 'Change grown-up PIN' : 'Set grown-up PIN'}</button><button class="primary" data-k-kidmode>Start Kid mode</button></div>
    <p class="note">The PIN is stored only on this device, so set one on each device kids use.</p></div>`;
  $('starsToggle').onchange = e => { data.settings.stars = e.target.checked; save(); toast(e.target.checked ? 'Stars on' : 'Stars off'); };
  $('pinBtn').onclick = () => openPinSetup();
}

/* ---------- Events (delegated so re-renders don't need re-binding) ---------- */
document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-k-add],[data-k-edit],[data-k-approve],[data-k-reopen],[data-k-give],[data-k-decline],[data-k-open],[data-k-kidmode],[data-km-kid],[data-km-step],[data-km-chore],[data-km-reward],[data-km-exit],[data-km-switch]');
  if (!t) return;
  const today = todayKey(), d = t.dataset;
  if (d.kAdd) return ({ chore: openChoreEditor, routine: () => openRoutineEditor(null), reward: openRewardEditor })[d.kAdd](null);
  if (d.kEdit) { const [type, id] = d.kEdit.split('|'); return ({ chore: openChoreEditor, routine: openRoutineEditor, reward: openRewardEditor })[type](id); }
  if (d.kApprove || d.kReopen) {
    const [id, day] = (d.kApprove || d.kReopen).split('|'), c = data.chores.find(x => x.id === id); if (!c) return;
    if (d.kApprove) { K.approveChore(data, c, day); toast(`Approved · ${STAR} ${c.stars || 0}`); } else { K.toggleChore(data, c, day); toast('Sent back'); }
    save(); return render();
  }
  if (d.kGive || d.kDecline) {
    if (!K.decide(data, d.kGive || d.kDecline, !!d.kGive)) return toast('Not enough stars for that yet.');
    save(); render(); return toast(d.kGive ? 'Reward given 🎁' : 'Maybe later');
  }
  if (d.kOpen) return openKidDay(d.kOpen);
  if ('kKidmode' in d) return startKidMode(filter !== 'all' ? filter : '');
  // Kid mode
  if (d.kmKid) { pref.set('ld_kid_mode', d.kmKid); return renderKidMode(); }
  if ('kmSwitch' in d) { pref.set('ld_kid_mode', '*'); return renderKidMode(); }
  if ('kmExit' in d) return openPinPad();
  if (d.kmStep) {
    const [rid, sid] = d.kmStep.split('|'), r = data.routines.find(x => x.id === rid); if (!r) return;
    const wasDone = K.routineDone(data, r, today), done = K.toggleStep(data, r, sid, today);
    save(); renderKidMode();
    if (done && !wasDone) celebrate(`${r.name} routine done!${starsOn() && r.stars ? ` +${r.stars} ${STAR}` : ''}`);
    return;
  }
  if (d.kmChore) {
    const c = data.chores.find(x => x.id === d.kmChore); if (!c) return;
    const st = K.toggleChore(data, c, today);
    save(); renderKidMode();
    if (st === 'done') celebrate(`Great job!${starsOn() && c.stars ? ` +${c.stars} ${STAR}` : ''}`);
    else if (st === 'waiting') toast('Nice! A grown-up will check it.');
    return;
  }
  if (d.kmReward) {
    if (t.getAttribute('aria-disabled') === 'true') return toast('Keep going, you’re saving up!');
    const r = data.rewards.find(x => x.id === d.kmReward), kidId = pref.get('ld_kid_mode', '');
    if (r && K.askReward(data, kidId, r)) { save(); renderKidMode(); celebrate('Asked! A grown-up will decide.'); }
  }
});
document.addEventListener('change', ev => {
  const t = ev.target.closest('[data-k-ptoggle]'); if (!t) return;
  const c = data.chores.find(x => x.id === t.dataset.kPtoggle); if (!c) return;
  K.toggleChore(data, c, todayKey(), { byParent: true }); save(); render(); openKidDay(c.kidId);
});

K.ensure(data); K.tidy(data, todayKey());
renderKidSettings();
render();
