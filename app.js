/* Little Days app: views, editing and local storage.
   Globals used by cloud.js / reminders.js: data, render(), setView(), getAllEvents(). */
'use strict';
const KEY = 'littledays_v1';
const core = window.LittleDaysCore;
const { dateKey, parseDate, plusDays, daysBetween, expandEvents, isPlanner } = core;

const EMOJIS = ['🌸', '🌟', '🦕', '🦋', '🎨', '⚽', '🎵', '🌈', '🐻', '🚀', '🐱', '🦄', '🐢', '🍓', '🏀', '📚'];
const COLOR_NAMES = ['Pink', 'Sky', 'Mint', 'Butter', 'Lavender', 'Peach'];
const CATEGORIES = [['School', '🎒'], ['Sports', '⚽'], ['Music', '🎵'], ['Appointment', '🩺'], ['Family', '🏡'], ['Birthday', '🎂'], ['Other', '✨']];
const catIcon = c => (CATEGORIES.find(x => x[0] === c) || ['', '✨'])[1];

let data;
try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { data = null; }
if (!isPlanner(data)) data = {
  kids: [
    { id: 'kid1', name: 'Child 1', emoji: '🌸', color: 0 }, { id: 'kid2', name: 'Child 2', emoji: '🌟', color: 1 },
    { id: 'kid3', name: 'Child 3', emoji: '🦕', color: 2 }, { id: 'kid4', name: 'Child 4', emoji: '🦋', color: 3 }
  ], events: [], tasks: []
};

const pref = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }
};
let view = 'today', filter = 'all', cursor = new Date();
let calMode = pref.get('ld_calendar_mode', 'month');
if (!['month', 'week', 'list'].includes(calMode)) calMode = 'month';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2);
const icon = (id, size = 16) => `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#${id}"/></svg>`;
const kidBy = id => data.kids.find(k => k.id === id);
const colorClass = k => k ? 'c' + ((Number(k.color) || 0) % 6) : 'cf';
const avatar = (k, size) => `<span class="avatar ${colorClass(k)}"${size ? ` style="--size:${size}px"` : ''} aria-hidden="true">${esc(k?.emoji || '🏡')}</span>`;
const nameOf = k => k ? k.name : 'Whole family';
const fmtTime = s => { if (!s) return 'All day'; const [h, m] = s.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };
const fmtDay = (s, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => parseDate(s).toLocaleDateString(undefined, opts);
const todayKey = () => dateKey(new Date());

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { toast('Could not save on this device. Export a backup.'); }
  window.littleDaysSync?.queue?.();
}

function getAllEvents(start, end) { return expandEvents(data.events, start, end); }
/* A child's view includes whole-family items too. */
const forFilter = list => list.filter(x => filter === 'all' || x.kidId === filter || !x.kidId);
function getEvents(start, end) { return forFilter(getAllEvents(start, end)); }

/* ---------- Toast ---------- */
let toastTimer;
function toast(text) {
  const t = $('toast'); t.textContent = text; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

/* ---------- Navigation ---------- */
function setView(v) {
  view = v;
  document.querySelectorAll('[data-page]').forEach(s => s.classList.toggle('hidden', s.dataset.page !== v));
  document.querySelectorAll('.tab[data-view]').forEach(b => { if (b.dataset.view === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  render();
  window.scrollTo(0, 0);
}

function render() {
  renderPeople();
  if (view === 'today') renderToday();
  else if (view === 'calendar') renderCalendar();
  else if (view === 'tasks') renderTasks();
  else if (view === 'family') renderFamily();
  else if (view === 'settings') renderSettings();
}

function renderPeople() {
  const html = `<button class="person" data-filter="all" aria-pressed="${filter === 'all'}">${avatar(null, 52)}<span>Everyone</span></button>` +
    data.kids.map(k => `<button class="person ${colorClass(k)}" data-filter="${esc(k.id)}" aria-pressed="${filter === k.id}">${avatar(k, 52)}<span>${esc(k.name)}</span></button>`).join('');
  ['todayPeople', 'calPeople', 'taskPeople'].forEach(id => { $(id).innerHTML = html; });
  document.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { filter = b.dataset.filter; render(); });
}

/* ---------- Today ---------- */
function greeting() {
  const h = new Date().getHours();
  const part = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const name = pref.get('ld_my_name', '').trim();
  return name ? `${part}, ${name}` : part;
}

function eventRow(e, showDay) {
  const k = kidBy(e.kidId);
  const meta = [];
  if (e.location) meta.push(`<span class="tag">${icon('i-pin', 14)}${esc(e.location)}</span>`);
  if (e.repeat && e.repeat !== 'none') meta.push(`<span class="tag">${icon('i-repeat', 14)}${e.repeat === 'daily' ? 'Every day' : 'Every week'}</span>`);
  if (e.pickupBy) meta.push(`<span class="pickup">${icon('i-car', 14)}${esc(e.pickupBy)}</span>`);
  return `<li><button class="item" data-event="${esc(e.id)}" aria-label="${esc(e.title)}, ${esc(fmtTime(e.time))}${showDay ? ', ' + esc(fmtDay(e.on)) : ''}, ${esc(nameOf(k))}. Edit">
    <span class="when">${esc(e.time ? fmtTime(e.time) : 'All day')}${showDay ? `<small>${esc(fmtDay(e.on))}</small>` : ''}</span>
    ${avatar(k)}
    <span class="what"><strong>${catIcon(e.category)} ${esc(e.title)}</strong><span class="meta"><span>${esc(nameOf(k))}</span>${meta.join('')}</span></span>
    <span class="end">${icon('i-pencil', 18)}</span>
  </button></li>`;
}

function renderRibbon(events) {
  const timed = events.filter(e => e.time), allDay = events.filter(e => !e.time);
  const startH = Math.min(7, ...timed.map(e => Number(e.time.slice(0, 2))));
  const endH = Math.max(21, ...timed.map(e => Number(e.time.slice(0, 2)) + 1));
  const span = (endH - startH) * 60;
  const pos = mins => Math.max(0, Math.min(100, ((mins - startH * 60) / span) * 100));
  const lanes = [];
  const items = timed.map(e => {
    const [h, m] = e.time.split(':').map(Number), mins = h * 60 + m;
    let lane = lanes.findIndex(last => mins - last >= span * 0.16);
    if (lane < 0) { lane = lanes.length; lanes.push(mins); } else lanes[lane] = mins;
    return { e, mins, lane };
  });
  const now = new Date(), nowMins = now.getHours() * 60 + now.getMinutes();
  const hours = [];
  for (let h = startH; h <= endH; h += 3) hours.push(`<span style="left:${pos(h * 60)}%">${new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' })}</span>`);
  const r = $('ribbon');
  r.style.setProperty('--lanes', Math.max(1, lanes.length));
  r.innerHTML = `<div class="ribbon-track"></div>` +
    (nowMins >= startH * 60 && nowMins <= endH * 60 ? `<div class="now" style="left:${pos(nowMins)}%" title="Now"></div>` : '') +
    items.map(({ e, mins, lane }) => {
      const k = kidBy(e.kidId);
      return `<button class="pebble ${colorClass(k)}${mins + 30 < nowMins ? ' past' : ''}" style="left:${pos(mins)}%;--lane:${lane}" data-event="${esc(e.id)}" title="${esc(fmtTime(e.time) + ' · ' + e.title)}" aria-label="${esc(fmtTime(e.time) + ', ' + e.title + ', ' + nameOf(k))}">${avatar(k)}<span>${esc(e.title)}</span></button>`;
    }).join('') +
    `<div class="ribbon-hours" aria-hidden="true">${hours.join('')}</div>`;
  r.setAttribute('aria-label', timed.length ? `Timeline of ${timed.length} timed activities today` : 'No timed activities today');
  $('allDay').innerHTML = allDay.map(e => { const k = kidBy(e.kidId); return `<button class="chip ${colorClass(k)}" data-event="${esc(e.id)}" style="border:0">${catIcon(e.category)} ${esc(e.title)} · all day</button>`; }).join('');
}

function renderToday() {
  const now = new Date(), today = dateKey(now);
  $('todayTitle').textContent = greeting();
  $('todayDate').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const todays = getEvents(today, today);
  const pickups = todays.filter(e => e.pickupBy).length;
  const who = filter === 'all' ? '' : ` for ${nameOf(kidBy(filter))}`;
  $('ribbonSummary').textContent = todays.length
    ? `${todays.length} ${todays.length === 1 ? 'activity' : 'activities'}${who}${pickups ? ` · ${pickups} pickup${pickups > 1 ? 's' : ''}` : ''}`
    : `Nothing planned${who}. A free day!`;
  renderRibbon(todays);
  $('todayList').innerHTML = todays.length ? todays.map(e => eventRow(e)).join('')
    : `<li class="empty">Nothing on the calendar today. Tap “Add activity” to plan something.</li>`;

  // Week strip
  const start = plusDays(now, -now.getDay());
  const week = getEvents(dateKey(start), dateKey(plusDays(start, 6)));
  $('weekStrip').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const d = plusDays(start, i), key = dateKey(d), evs = week.filter(e => e.on === key);
    const dots = evs.slice(0, 6).map(e => `<span class="dot ${colorClass(kidBy(e.kidId))}"></span>`).join('');
    return `<button class="wday${key === today ? ' is-today' : ''}" data-day="${key}" aria-label="${esc(fmtDay(key, { weekday: 'long', month: 'long', day: 'numeric' }))}: ${evs.length} ${evs.length === 1 ? 'activity' : 'activities'}">
      <span>${esc(d.toLocaleDateString(undefined, { weekday: 'narrow' }))}</span><b>${d.getDate()}</b><span class="dots">${dots}</span></button>`;
  }).join('');

  // Coming up: next 7 days after today, grouped by day
  // Daily repeats (like school drop-off) are routine, so they stay on Today only.
  const upcoming = getEvents(dateKey(plusDays(now, 1)), dateKey(plusDays(now, 7))).filter(e => e.repeat !== 'daily').slice(0, 8);
  let lastDay = '', html = '';
  upcoming.forEach(e => {
    if (e.on !== lastDay) {
      if (lastDay) html += '</ul>';
      lastDay = e.on;
      const label = daysBetween(now, parseDate(e.on)) === 1 ? 'Tomorrow' : fmtDay(e.on, { weekday: 'long', month: 'short', day: 'numeric' });
      html += `<p class="day-label">${esc(label)}</p><ul class="agenda">`;
    }
    html += eventRow(e);
  });
  $('comingUp').innerHTML = upcoming.length ? html + '</ul>' : '<p class="empty">Nothing planned for the next 7 days.</p>';

  // To-dos: overdue, due today/soon, then undated
  const open = forFilter(data.tasks).filter(t => !t.done)
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')).slice(0, 6);
  $('todayTodos').innerHTML = open.length ? open.map(todoRow).join('') : '<p class="empty">All caught up. 🎉</p>';

  // Birthdays in the next 60 days
  const bdays = data.kids.filter(k => core.isDateKey(k.birthday)).map(k => {
    const b = parseDate(k.birthday);
    let next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
    if (dateKey(next) < today) next = new Date(now.getFullYear() + 1, b.getMonth(), b.getDate());
    return { k, next, inDays: daysBetween(now, next), age: next.getFullYear() - b.getFullYear() };
  }).filter(x => x.inDays <= 60).sort((a, b) => a.inDays - b.inDays);
  $('bdayCard').classList.toggle('hidden', !bdays.length);
  $('birthdays').innerHTML = bdays.map(({ k, next, inDays, age }) => `<div class="bday">${avatar(k)}<div><strong>${esc(k.name)} turns ${age}</strong><small>${inDays === 0 ? 'Today! 🎂' : inDays === 1 ? 'Tomorrow' : `${esc(next.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }))} · in ${inDays} days`}</small></div></div>`).join('');

  bindItems();
}
/* ---------- To-dos ---------- */
function todoRow(t) {
  const k = kidBy(t.kidId), today = todayKey();
  const due = t.due ? (t.due < today && !t.done ? `<span class="overdue">Overdue · ${esc(fmtDay(t.due))}</span>` : t.due === today ? 'Today' : esc(fmtDay(t.due))) : '';
  return `<div class="todo ${colorClass(k)}${t.done ? ' done' : ''}">
    <input type="checkbox" class="check" data-toggle="${esc(t.id)}" ${t.done ? 'checked' : ''} aria-label="${esc(t.title)}${t.done ? ', done' : ''}">
    <div class="label"><span>${esc(t.title)}</span><small>${esc(nameOf(k))}${due ? ' · ' + due : ''}</small></div>
    <button class="icon-btn" data-task="${esc(t.id)}" aria-label="Edit ${esc(t.title)}">${icon('i-pencil', 18)}</button>
  </div>`;
}

function renderTasks() {
  const list = forFilter(data.tasks), today = todayKey();
  const groups = [
    ['Overdue', list.filter(t => !t.done && t.due && t.due < today)],
    ['Today', list.filter(t => !t.done && t.due === today)],
    ['Coming up', list.filter(t => !t.done && t.due && t.due > today)],
    ['Anytime', list.filter(t => !t.done && !t.due)],
    ['Done', list.filter(t => t.done)]
  ].filter(g => g[1].length);
  groups.forEach(g => g[1].sort((a, b) => (a.due || '').localeCompare(b.due || '')));
  $('tasksList').innerHTML = groups.length
    ? groups.map(([title, items]) => `<h2 class="group-title">${title}</h2>${items.map(todoRow).join('')}`).join('')
    : '<p class="empty">No to-dos yet. Add one for the family or for a child.</p>';
  bindItems();
}

/* ---------- Calendar ---------- */
function renderCalendar() {
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === calMode));
  const today = todayKey();
  const body = $('calBody');
  if (calMode === 'month') {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1), start = plusDays(first, -first.getDay());
    const evs = getEvents(dateKey(start), dateKey(plusDays(start, 41))), by = {};
    evs.forEach(e => (by[e.on] ??= []).push(e));
    $('calTitle').textContent = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    let html = Array.from({ length: 7 }, (_, i) => `<div class="wk" aria-hidden="true">${esc(plusDays(start, i).toLocaleDateString(undefined, { weekday: 'short' }))}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const d = plusDays(start, i), key = dateKey(d), items = by[key] || [];
      html += `<div class="mday${d.getMonth() !== first.getMonth() ? ' outside' : ''}${key === today ? ' is-today' : ''}" data-day="${key}" role="button" tabindex="0" aria-label="${esc(fmtDay(key, { weekday: 'long', month: 'long', day: 'numeric' }))}: ${items.length} ${items.length === 1 ? 'activity' : 'activities'}">
        <span class="num">${d.getDate()}</span>
        ${items.slice(0, 3).map(e => `<button class="chip ${colorClass(kidBy(e.kidId))}" data-event="${esc(e.id)}">${esc(e.title)}</button>`).join('')}
        ${items.length > 3 ? `<span class="more">+${items.length - 3} more</span>` : ''}
        <span class="mdots">${items.slice(0, 4).map(e => `<span class="dot ${colorClass(kidBy(e.kidId))}"></span>`).join('')}</span>
      </div>`;
    }
    body.innerHTML = `<div class="month">${html}</div>`;
  } else if (calMode === 'week') {
    const start = plusDays(cursor, -cursor.getDay()), end = plusDays(start, 6);
    const evs = getEvents(dateKey(start), dateKey(end));
    $('calTitle').textContent = `${fmtDay(dateKey(start), { month: 'short', day: 'numeric' })} – ${fmtDay(dateKey(end), { month: 'short', day: 'numeric' })}`;
    body.innerHTML = `<div class="weekcols">${Array.from({ length: 7 }, (_, i) => {
      const d = plusDays(start, i), key = dateKey(d), items = evs.filter(e => e.on === key);
      return `<div class="wcol${key === today ? ' is-today' : ''}" data-day="${key}" role="button" tabindex="0" aria-label="Add activity on ${esc(fmtDay(key, { weekday: 'long', month: 'long', day: 'numeric' }))}">
        <h3>${esc(d.toLocaleDateString(undefined, { weekday: 'short' }))} <b>${d.getDate()}</b></h3>
        ${items.map(e => `<button class="block ${colorClass(kidBy(e.kidId))}" data-event="${esc(e.id)}">${esc(e.title)}<small>${esc(fmtTime(e.time))}${e.pickupBy ? ' · 🚗 ' + esc(e.pickupBy) : ''}</small></button>`).join('')}
      </div>`;
    }).join('')}</div>`;
  } else {
    const start = dateKey(cursor), end = dateKey(plusDays(cursor, 60));
    const evs = getEvents(start, end).slice(0, 200);
    $('calTitle').textContent = `From ${fmtDay(start, { month: 'short', day: 'numeric' })}`;
    let lastDay = '', html = '';
    evs.forEach(e => {
      if (e.on !== lastDay) { if (lastDay) html += '</ul>'; lastDay = e.on; html += `<p class="day-label">${esc(fmtDay(e.on, { weekday: 'long', month: 'long', day: 'numeric' }))}</p><ul class="agenda">`; }
      html += eventRow(e);
    });
    body.innerHTML = `<div class="card">${evs.length ? html + '</ul>' : '<p class="empty">Nothing planned in the next two months.</p>'}</div>`;
  }
  bindItems();
}

/* ---------- Family ---------- */
function renderFamily() {
  const today = todayKey(), weekEnd = dateKey(plusDays(new Date(), 6));
  $('familyGrid').innerHTML = data.kids.map(k => {
    const week = getAllEvents(today, weekEnd).filter(e => e.kidId === k.id).length;
    const open = data.tasks.filter(t => t.kidId === k.id && !t.done).length;
    return `<button class="card member ${colorClass(k)}" data-kid="${esc(k.id)}" aria-label="Edit ${esc(k.name)}">
      ${avatar(k)}
      <div><h3>${esc(k.name)}</h3><p>${k.birthday ? 'Birthday ' + esc(fmtDay(k.birthday, { month: 'long', day: 'numeric' })) : COLOR_NAMES[(Number(k.color) || 0) % 6]}</p></div>
      <div class="chips"><span class="chip">${week} this week</span><span class="chip">${open} to-do${open === 1 ? '' : 's'}</span></div>
    </button>`;
  }).join('') || '<p class="empty">Add your first child to get started.</p>';
  bindItems();
}

/* ---------- Settings ---------- */
function renderSettings() {
  $('myName').value = pref.get('ld_my_name', '');
  const theme = pref.get('ld_theme', 'system');
  document.querySelectorAll('[data-theme-choice]').forEach(b => b.setAttribute('aria-pressed', b.dataset.themeChoice === theme));
}
$('myName').addEventListener('change', e => { pref.set('ld_my_name', e.target.value.trim()); toast('Saved'); });
document.querySelectorAll('[data-theme-choice]').forEach(b => b.onclick = () => {
  const t = b.dataset.themeChoice; pref.set('ld_theme', t);
  if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  renderSettings();
});

/* ---------- Shared bindings ---------- */
function bindItems() {
  document.querySelectorAll('[data-event]').forEach(b => b.onclick = ev => { ev.stopPropagation(); openEditor('event', b.dataset.event); });
  document.querySelectorAll('[data-task]').forEach(b => b.onclick = () => openEditor('task', b.dataset.task));
  document.querySelectorAll('[data-kid]').forEach(b => b.onclick = () => openEditor('kid', b.dataset.kid));
  document.querySelectorAll('[data-toggle]').forEach(b => b.onchange = () => {
    const t = data.tasks.find(x => x.id === b.dataset.toggle); if (!t) return;
    t.done = b.checked; save(); render(); if (t.done) toast('Nice! Done ✓');
  });
  document.querySelectorAll('.wday[data-day]').forEach(b => b.onclick = () => { cursor = parseDate(b.dataset.day); calMode = 'week'; pref.set('ld_calendar_mode', 'week'); setView('calendar'); });
  document.querySelectorAll('.mday[data-day], .wcol[data-day]').forEach(b => {
    const open = () => openEditor('event', null, b.dataset.day);
    b.onclick = open;
    b.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); } };
  });
}

/* ---------- Sheets ---------- */
let lastFocus = null;
function openSheet(html) {
  lastFocus = document.activeElement;
  $('sheet').innerHTML = html;
  $('scrim').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => ($('sheet').querySelector('[autofocus], input, select, button'))?.focus(), 30);
}
function closeSheet() {
  $('scrim').classList.add('hidden');
  document.body.style.overflow = '';
  lastFocus?.focus?.();
}
$('scrim').addEventListener('click', e => { if (e.target === $('scrim')) closeSheet(); });
document.addEventListener('keydown', e => {
  if ($('scrim').classList.contains('hidden')) return;
  if (e.key === 'Escape') closeSheet();
  if (e.key === 'Tab') { // keep focus inside the sheet
    const f = [...$('sheet').querySelectorAll('button, input, select, textarea, [tabindex="0"]')].filter(x => !x.disabled);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});

function openQuickAdd() {
  openSheet(`<h2 id="sheetTitle">Add to Little Days</h2><div class="quick">
    <button class="c1" data-q="event"><span class="q-icon" aria-hidden="true">🗓️</span><span>Activity<small>Practice, lesson, appointment, party</small></span></button>
    <button class="c2" data-q="task"><span class="q-icon" aria-hidden="true">✅</span><span>To-do<small>Something to remember or get done</small></span></button>
    <button class="c0" data-q="kid"><span class="q-icon" aria-hidden="true">💗</span><span>Child<small>Add someone to the family</small></span></button>
  </div><div class="sheet-actions"><span></span><div class="end"><button class="btn" type="button" data-close>Cancel</button></div></div>`);
  $('sheet').querySelectorAll('[data-q]').forEach(b => b.onclick = () => openEditor(b.dataset.q));
  $('sheet').querySelector('[data-close]').onclick = closeSheet;
}

const field = (label, id, html) => `<div class="field"><label for="${id}">${label}</label>${html}</div>`;
function kidOptions(sel) {
  return `<option value="">🏡 Whole family</option>` + data.kids.map(k => `<option value="${esc(k.id)}"${sel === k.id ? ' selected' : ''}>${esc(k.emoji)} ${esc(k.name)}</option>`).join('');
}

function openEditor(mode, id = null, day = null) {
  const list = mode === 'event' ? 'events' : mode === 'task' ? 'tasks' : 'kids';
  const o = id ? data[list].find(x => x.id === id) : null;
  if (id && !o) return;
  const noun = { event: 'activity', task: 'to-do', kid: 'child' }[mode];
  let html = `<form id="editForm" novalidate><h2 id="sheetTitle">${o ? 'Edit' : 'New'} ${noun}</h2>`;
  if (mode === 'event') {
    const defaultKid = o ? o.kidId : (filter !== 'all' ? filter : '');
    html += field('What’s happening?', 'fTitle', `<input id="fTitle" name="title" maxlength="90" required placeholder="Soccer practice" value="${esc(o?.title)}" autofocus>`)
      + `<div class="two">${field('Who', 'fKid', `<select id="fKid" name="kidId">${kidOptions(defaultKid)}</select>`)}
        ${field('Type', 'fCat', `<select id="fCat" name="category">${CATEGORIES.map(([c, i]) => `<option value="${c}"${(o?.category || 'Other') === c ? ' selected' : ''}>${i} ${c}</option>`).join('')}</select>`)}</div>`
      + `<div class="two">${field('Date', 'fDate', `<input id="fDate" name="date" type="date" required value="${esc(o?.date || day || todayKey())}">`)}
        ${field('Time (leave empty for all day)', 'fTime', `<input id="fTime" name="time" type="time" value="${esc(o?.time)}">`)}</div>`
      + field('Where', 'fLoc', `<input id="fLoc" name="location" maxlength="120" placeholder="School gym" value="${esc(o?.location)}">`)
      + field('Pickup / drop-off', 'fPick', `<input id="fPick" name="pickupBy" maxlength="60" placeholder="Mom, Dad, carpool" value="${esc(o?.pickupBy)}">`)
      + field('Repeats', 'fRep', `<select id="fRep" name="repeat">${[['none', 'Does not repeat'], ['daily', 'Every day'], ['weekly', 'Every week']].map(([v, l]) => `<option value="${v}"${(o?.repeat || 'none') === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`)
      + field('Notes', 'fNotes', `<textarea id="fNotes" name="notes" maxlength="500" placeholder="Bring water bottle and shin guards">${esc(o?.notes)}</textarea>`);
  } else if (mode === 'task') {
    html += field('To-do', 'fTitle', `<input id="fTitle" name="title" maxlength="120" required placeholder="Sign field trip form" value="${esc(o?.title)}" autofocus>`)
      + `<div class="two">${field('For', 'fKid', `<select id="fKid" name="kidId">${kidOptions(o ? o.kidId : (filter !== 'all' ? filter : ''))}</select>`)}
        ${field('Due (optional)', 'fDue', `<input id="fDue" name="due" type="date" value="${esc(o?.due)}">`)}</div>`;
  } else {
    const color = o ? (Number(o.color) || 0) % 6 : data.kids.length % 6;
    const emoji = o?.emoji || EMOJIS[data.kids.length % EMOJIS.length];
    html += field('Name', 'fName', `<input id="fName" name="name" maxlength="40" required placeholder="Yuna" value="${esc(o?.name)}" autofocus>`)
      + field('Birthday (optional)', 'fBday', `<input id="fBday" name="birthday" type="date" value="${esc(o?.birthday)}">`)
      + `<div class="field"><span class="label" id="colorLbl">Color</span><div class="swatches" role="radiogroup" aria-labelledby="colorLbl">${COLOR_NAMES.map((n, i) => `<label class="c${i}"><input type="radio" name="color" value="${i}"${i === color ? ' checked' : ''} aria-label="${n}"><span></span></label>`).join('')}</div></div>`
      + `<div class="field"><span class="label" id="emojiLbl">Avatar</span><div class="swatches emoji-pick" role="radiogroup" aria-labelledby="emojiLbl">${EMOJIS.map(e => `<label><input type="radio" name="emoji" value="${e}"${e === emoji ? ' checked' : ''} aria-label="${e}"><span>${e}</span></label>`).join('')}</div></div>`;
  }
  html += `<p class="cloud-msg error" id="formError" role="alert"></p><div class="sheet-actions">${o ? `<button type="button" class="btn danger" id="delItem">Delete</button>` : '<span></span>'}
    <div class="end">${o && mode === 'event' ? '<button type="button" class="btn" id="copyItem">Duplicate</button>' : ''}<button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary">Save</button></div></div></form>`;
  openSheet(html);
  const form = $('editForm');
  form.querySelector('[data-close]').onclick = closeSheet;
  form.onsubmit = ev => {
    ev.preventDefault();
    const raw = Object.fromEntries(new FormData(form).entries());
    const req = mode === 'kid' ? 'name' : 'title';
    raw[req] = (raw[req] || '').trim();
    if (!raw[req]) { $('formError').textContent = mode === 'kid' ? 'Add a name.' : 'Give it a name.'; form.querySelector(`[name=${req}]`).focus(); return; }
    if (mode === 'event' && !core.isDateKey(raw.date)) { $('formError').textContent = 'Pick a date.'; return; }
    if (mode === 'kid') raw.color = Number(raw.color) || 0;
    if (mode === 'task') raw.done = o?.done || false;
    if (o) Object.assign(o, raw); else data[list].push({ id: uid(), ...raw });
    save(); closeSheet(); render(); toast(o ? 'Saved' : `${noun[0].toUpperCase() + noun.slice(1)} added`);
  };
  if (o) $('delItem').onclick = () => {
    if (!confirm(mode === 'kid' ? `Remove ${o.name}? Their activities and to-dos stay, assigned to the whole family.` : `Delete “${o.title}”?`)) return;
    data[list] = data[list].filter(x => x.id !== id);
    if (mode === 'kid') { data.events.forEach(x => { if (x.kidId === id) x.kidId = ''; }); data.tasks.forEach(x => { if (x.kidId === id) x.kidId = ''; }); if (filter === id) filter = 'all'; }
    save(); closeSheet(); render(); toast('Deleted');
  };
  const copy = $('copyItem');
  if (copy) copy.onclick = () => { const c = { ...o, id: uid(), title: o.title + ' (copy)' }; data.events.push(c); save(); openEditor('event', c.id); toast('Duplicated'); };
}

/* ---------- Static bindings ---------- */
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
document.querySelectorAll('[data-quick-add]').forEach(b => b.onclick = openQuickAdd);
document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => openEditor(b.dataset.add));
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { calMode = b.dataset.mode; pref.set('ld_calendar_mode', calMode); renderCalendar(); });
$('calPrev').onclick = () => { cursor = calMode === 'month' ? new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1) : plusDays(cursor, calMode === 'week' ? -7 : -30); renderCalendar(); };
$('calNext').onclick = () => { cursor = calMode === 'month' ? new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) : plusDays(cursor, calMode === 'week' ? 7 : 30); renderCalendar(); };
$('calToday').onclick = () => { cursor = new Date(); renderCalendar(); };

$('export').onclick = () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `little-days-backup-${todayKey()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('importButton').onclick = () => $('importFile').click();
$('importFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const obj = JSON.parse(await f.text());
    if (!isPlanner(obj)) throw Error('This file is not a Little Days backup.');
    if (!confirm('Replace your current planner with this backup?')) return;
    data = obj; filter = 'all'; save(); render(); toast('Backup imported');
  } catch (err) { alert('Could not import backup: ' + err.message); }
  e.target.value = '';
};
$('reset').onclick = () => {
  if (!confirm('Erase all children, activities and to-dos from this device? This can’t be undone unless you have a backup.')) return;
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  location.reload();
};

// Keep "now" and greetings fresh while the app stays open.
setInterval(() => { if (view === 'today' && $('scrim').classList.contains('hidden')) renderToday(); }, 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') render(); });

setView('today');
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
