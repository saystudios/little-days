/* Little Days app: views, editing and local storage.
   Globals used by cloud.js / reminders.js: data, render(), setView(), getAllEvents(). */
'use strict';
const KEY = 'littledays_v1';
const core = window.LittleDaysCore;
const { dateKey, parseDate, plusDays, daysBetween, expandEvents, isPlanner } = core;

const EMOJIS = ['🌸', '🌟', '🦕', '🦋', '🎨', '⚽', '🎵', '🌈', '🐻', '🚀', '🐱', '🦄', '🐢', '🍓', '🏀', '📚'];
const COLOR_NAMES = ['Pink', 'Sky', 'Mint', 'Butter', 'Lavender', 'Peach'];
const CATEGORIES = [['School', '🎒'], ['Sports', '⚽'], ['Music', '🎵'], ['Appointment', '🩺'], ['Family', '🏡'], ['Birthday', '🎂'], ['Holiday', '🎉'], ['Other', '✨']];
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
if (!['day', 'week', 'month', 'list'].includes(calMode)) calMode = 'month';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2);
const icon = (id, size = 16) => `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#${id}"/></svg>`;
const kidBy = id => data.kids.find(k => k.id === id);
const colorClass = k => k ? 'c' + ((Number(k.color) || 0) % 6) : 'cf';
const avatar = (k, size) => `<span class="avatar ${colorClass(k)}"${size ? ` style="--size:${size}px"` : ''} aria-hidden="true">${esc(k?.emoji || '🏡')}</span>`;
const nameOf = k => k ? k.name : 'Whole family';
const fmtRange = e => e.time ? fmtTime(e.time) + (e.endTime ? '–' + fmtTime(e.endTime) : '') : 'All day';
const fmtTime = s => { if (!s) return 'All day'; const [h, m] = s.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };
const fmtDay = (s, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => parseDate(s).toLocaleDateString(undefined, opts);
const todayKey = () => dateKey(new Date());

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { toast('Could not save on this device. Export a backup.'); }
  window.littleDaysSync?.queue?.();
  afterChange();
}
/* The planner changed (here or from another device): refresh reminders and
   the iPhone/iPad storage backup. */
function afterChange() {
  window.littleDaysReminders?.apply?.();
  window.dispatchEvent(new Event('littledays:saved'));
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
  if (window.LittleDaysKids) LittleDaysKids.ensure(data);   // new fields for planners from older versions or the cloud
  renderPeople();
  if (view === 'today') { renderToday(); if (typeof renderKidsToday === 'function') renderKidsToday(); }
  else if (view === 'calendar') renderCalendar();
  else if (view === 'tasks') renderTasks();
  else if (view === 'family') { renderFamily(); if (typeof renderKidsFamily === 'function') renderKidsFamily(); }
  else if (view === 'settings') renderSettings();
  if (typeof renderKidMode === 'function') renderKidMode();
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
  const rep = core.describeRepeat(e);
  if (rep) meta.push(`<span class="tag">${icon('i-repeat', 14)}${esc(rep)}</span>`);
  if (e.pickupBy) meta.push(`<span class="pickup">${icon('i-car', 14)}${esc(e.pickupBy)}</span>`);
  return `<li><button class="item" data-event="${esc(e.id)}" data-on="${esc(e.on)}" aria-label="${esc(e.title)}, ${esc(fmtTime(e.time))}${showDay ? ', ' + esc(fmtDay(e.on)) : ''}, ${esc(nameOf(k))}. Edit">
    <span class="when">${esc(e.time ? fmtTime(e.time) : 'All day')}${e.endTime ? `<small>to ${esc(fmtTime(e.endTime))}</small>` : ''}${showDay ? `<small>${esc(fmtDay(e.on))}</small>` : ''}</span>
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
      return `<button class="pebble ${colorClass(k)}${mins + 30 < nowMins ? ' past' : ''}" style="left:${pos(mins)}%;--lane:${lane}" data-event="${esc(e.id)}" data-on="${esc(e.on)}" title="${esc(fmtTime(e.time) + ' · ' + e.title)}" aria-label="${esc(fmtTime(e.time) + ', ' + e.title + ', ' + nameOf(k))}">${avatar(k)}<span>${esc(e.title)}</span></button>`;
    }).join('') +
    `<div class="ribbon-hours" aria-hidden="true">${hours.join('')}</div>`;
  r.setAttribute('aria-label', timed.length ? `Timeline of ${timed.length} timed activities today` : 'No timed activities today');
  $('allDay').innerHTML = allDay.map(e => { const k = kidBy(e.kidId); return `<button class="chip ${colorClass(k)}" data-event="${esc(e.id)}" data-on="${esc(e.on)}" style="border:0">${catIcon(e.category)} ${esc(e.title)} · all day</button>`; }).join('');
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
  const upcoming = getEvents(dateKey(plusDays(now, 1)), dateKey(plusDays(now, 7))).filter(e => !isRoutineRepeat(e)).slice(0, 8);
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
/* Repeats that happen most days (school runs) are left out of "Coming up". */
function isRoutineRepeat(e) {
  const r = core.ruleOf(e);
  return (r.repeat === 'daily' && r.interval === 1) || (r.repeat === 'weekly' && r.interval === 1 && r.days.length >= 5);
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
    ? groups.map(([title, items]) => `<h3 class="group-title">${title}</h3>${items.map(todoRow).join('')}`).join('')
    : '<p class="empty">No to-dos yet. Add one for the family or for a child.</p>';
  if (typeof renderLists === 'function') renderLists();
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
        ${items.slice(0, 3).map(e => `<button class="chip ${colorClass(kidBy(e.kidId))}" data-event="${esc(e.id)}" data-on="${esc(e.on)}" draggable="true">${esc(e.title)}</button>`).join('')}
        ${items.length > 3 ? `<span class="more">+${items.length - 3} more</span>` : ''}
        <span class="mdots">${items.slice(0, 4).map(e => `<span class="dot ${colorClass(kidBy(e.kidId))}"></span>`).join('')}</span>
      </div>`;
    }
    body.innerHTML = `<div class="month">${html}</div>`;
  } else if (calMode === 'day') {
    renderDay(body, today);
  } else if (calMode === 'week') {
    const start = plusDays(cursor, -cursor.getDay()), end = plusDays(start, 6);
    const evs = getEvents(dateKey(start), dateKey(end));
    $('calTitle').textContent = `${fmtDay(dateKey(start), { month: 'short', day: 'numeric' })} – ${fmtDay(dateKey(end), { month: 'short', day: 'numeric' })}`;
    body.innerHTML = `<div class="weekcols">${Array.from({ length: 7 }, (_, i) => {
      const d = plusDays(start, i), key = dateKey(d), items = evs.filter(e => e.on === key);
      return `<div class="wcol${key === today ? ' is-today' : ''}" data-day="${key}" role="button" tabindex="0" aria-label="Open ${esc(fmtDay(key, { weekday: 'long', month: 'long', day: 'numeric' }))}">
        <h3>${esc(d.toLocaleDateString(undefined, { weekday: 'short' }))} <b>${d.getDate()}</b></h3>
        ${items.map(e => `<button class="block ${colorClass(kidBy(e.kidId))}" data-event="${esc(e.id)}" data-on="${esc(e.on)}" draggable="true">${esc(e.title)}<small>${esc(fmtRange(e))}${e.pickupBy ? ' · 🚗 ' + esc(e.pickupBy) : ''}</small></button>`).join('')}
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
  bindDrag();
  bindTouchDrag();
}

/* Day view: an hour grid; overlapping activities sit side by side. */
const HOUR_PX = 56;
function renderDay(body, today) {
  const key = dateKey(cursor), evs = getEvents(key, key);
  $('calTitle').textContent = fmtDay(key, { weekday: 'long', month: 'short', day: 'numeric' });
  const timed = evs.filter(e => e.time).map(e => {
    const start = core.minutesOf(e.time), endRaw = core.minutesOf(e.endTime);
    return { e, start, end: endRaw && endRaw > start ? endRaw : start + 60 };
  }).sort((a, b) => a.start - b.start || b.end - a.end);
  const startH = Math.min(7, ...timed.map(t => Math.floor(t.start / 60)));
  const endH = Math.max(21, ...timed.map(t => Math.ceil(t.end / 60)));
  // Overlap clusters -> columns
  let cluster = [], clusterEnd = -1;
  const flush = () => { const cols = Math.max(...cluster.map(t => t.col)) + 1; cluster.forEach(t => { t.cols = cols; }); cluster = []; };
  timed.forEach(t => {
    if (t.start >= clusterEnd && cluster.length) flush();
    const used = cluster.filter(c => c.end > t.start).map(c => c.col);
    t.col = 0; while (used.includes(t.col)) t.col++;
    cluster.push(t); clusterEnd = Math.max(clusterEnd, t.end);
  });
  if (cluster.length) flush();
  const y = m => (m - startH * 60) / 60 * HOUR_PX;
  let grid = '';
  for (let h = startH; h < endH; h++) {
    const label = new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });
    grid += `<button class="slot" style="top:${(h - startH) * HOUR_PX}px" data-new-day="${key}" data-new-time="${String(h).padStart(2, '0')}:00" aria-label="Add activity at ${esc(label)}"><span>${esc(label)}</span></button>`;
  }
  const now = new Date(), nowM = now.getHours() * 60 + now.getMinutes();
  const blocks = timed.map(t => {
    const k = kidBy(t.e.kidId), h = Math.max(30, y(t.end) - y(t.start) - 3);
    return `<button class="dblock ${colorClass(k)}" style="top:${y(t.start)}px;height:${h}px;left:calc(var(--gut) + (100% - var(--gut)) * ${t.col / t.cols});width:calc((100% - var(--gut)) / ${t.cols} - 4px)" data-event="${esc(t.e.id)}" data-on="${esc(key)}">
      <strong>${catIcon(t.e.category)} ${esc(t.e.title)}</strong><small>${esc(fmtRange(t.e))} · ${esc(nameOf(k))}${t.e.location ? ' · ' + esc(t.e.location) : ''}</small></button>`;
  }).join('');
  const allDay = evs.filter(e => !e.time);
  body.innerHTML = `<div class="card dayview">
    ${allDay.length ? `<div class="allday">${allDay.map(e => `<button class="chip ${colorClass(kidBy(e.kidId))}" style="border:0" data-event="${esc(e.id)}" data-on="${esc(key)}">${catIcon(e.category)} ${esc(e.title)} · all day</button>`).join('')}</div>` : ''}
    <div class="daygrid" style="height:${(endH - startH) * HOUR_PX}px">${grid}${key === today && nowM >= startH * 60 && nowM <= endH * 60 ? `<div class="nowline" style="top:${y(nowM)}px"></div>` : ''}${blocks}</div>
    ${evs.length ? '' : '<p class="empty">Nothing planned. Tap an hour to add an activity.</p>'}
  </div>`;
  body.querySelectorAll('[data-new-time]').forEach(b => b.onclick = () => openEditor('event', null, b.dataset.newDay, null, b.dataset.newTime));
}

/* Drag an activity to another day (mouse and trackpad). A repeating
   activity moves only that one occurrence. */
function bindDrag() {
  document.querySelectorAll('#calBody [draggable="true"]').forEach(el => {
    el.ondragstart = ev => { ev.dataTransfer.setData('text/plain', el.dataset.event + '|' + el.dataset.on); ev.dataTransfer.effectAllowed = 'move'; };
  });
  document.querySelectorAll('#calBody .mday, #calBody .wcol').forEach(cell => {
    cell.ondragover = ev => { ev.preventDefault(); cell.classList.add('drop'); };
    cell.ondragleave = () => cell.classList.remove('drop');
    cell.ondrop = ev => {
      ev.preventDefault(); cell.classList.remove('drop');
      const [id, on] = (ev.dataTransfer.getData('text/plain') || '').split('|');
      if (id && on && cell.dataset.day !== on) moveOccurrence(id, on, cell.dataset.day);
    };
  });
}

/* Touch screens (iPad, iPhone): long-press an activity, then drag it to
   another day. A short swipe still scrolls as usual. */
let touchDrag = null, suppressClick = false;
function bindTouchDrag() {
  document.querySelectorAll('#calBody [draggable="true"]').forEach(el => {
    el.addEventListener('touchstart', ev => {
      if (ev.touches.length !== 1) return;
      const t = ev.touches[0];
      touchDrag = { el, x: t.clientX, y: t.clientY, active: false, over: null,
        timer: setTimeout(() => {
          if (!touchDrag) return;
          touchDrag.active = true;
          window.littleDaysNative?.tap?.();
          const r = el.getBoundingClientRect(), ghost = el.cloneNode(true);
          ghost.className += ' drag-ghost'; ghost.style.width = r.width + 'px';
          ghost.style.left = (touchDrag.x - r.width / 2) + 'px'; ghost.style.top = (touchDrag.y - 20) + 'px';
          document.body.append(ghost); touchDrag.ghost = ghost; el.classList.add('dragging');
        }, 450) };
    }, { passive: true });
  });
}
document.addEventListener('touchmove', ev => {
  if (!touchDrag) return;
  const t = ev.touches[0];
  if (!touchDrag.active) {
    if (Math.hypot(t.clientX - touchDrag.x, t.clientY - touchDrag.y) > 10) { clearTimeout(touchDrag.timer); touchDrag = null; }
    return;
  }
  ev.preventDefault();
  touchDrag.ghost.style.left = (t.clientX - touchDrag.ghost.offsetWidth / 2) + 'px';
  touchDrag.ghost.style.top = (t.clientY - 20) + 'px';
  touchDrag.ghost.hidden = true;
  const cell = document.elementFromPoint(t.clientX, t.clientY)?.closest('#calBody .mday, #calBody .wcol');
  touchDrag.ghost.hidden = false;
  if (touchDrag.over !== cell) { touchDrag.over?.classList.remove('drop'); cell?.classList.add('drop'); touchDrag.over = cell; }
}, { passive: false });
function endTouchDrag() {
  if (!touchDrag) return;
  clearTimeout(touchDrag.timer);
  const d = touchDrag; touchDrag = null;
  if (!d.active) return;
  d.ghost?.remove(); d.el.classList.remove('dragging'); d.over?.classList.remove('drop');
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 400);
  if (d.over && d.over.dataset.day !== d.el.dataset.on) moveOccurrence(d.el.dataset.event, d.el.dataset.on, d.over.dataset.day);
}
document.addEventListener('touchend', endTouchDrag);
document.addEventListener('touchcancel', endTouchDrag);
document.addEventListener('click', ev => { if (suppressClick) { ev.stopPropagation(); ev.preventDefault(); } }, true);

function moveOccurrence(id, on, toDay) {
  const o = data.events.find(x => x.id === id); if (!o) return;
  if (core.ruleOf(o).repeat === 'none') o.date = toDay;
  else { detachOccurrence(o, on, { date: toDay }); }
  save(); render();
  toast(core.ruleOf(o).repeat === 'none' ? `Moved to ${fmtDay(toDay)}` : `Moved just this one to ${fmtDay(toDay)}`);
}

/* Take one day out of a series and (optionally) replace it with a one-off copy. */
const SERIES_FIELDS = ['repeat', 'interval', 'days', 'monthBy', 'until', 'skip'];
function detachOccurrence(o, on, changes) {
  o.skip = [...new Set([...(o.skip || []), on])];
  if (!changes) return null;
  const one = { ...o, id: uid(), date: on, ...changes, repeat: 'none' };
  SERIES_FIELDS.filter(f => f !== 'repeat').forEach(f => delete one[f]);
  data.events.push(one);
  return one;
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
  document.querySelectorAll('[data-event]').forEach(b => b.onclick = ev => { ev.stopPropagation(); openEditor('event', b.dataset.event, null, b.dataset.on); });
  document.querySelectorAll('[data-task]').forEach(b => b.onclick = () => openEditor('task', b.dataset.task));
  document.querySelectorAll('[data-kid]').forEach(b => b.onclick = () => openEditor('kid', b.dataset.kid));
  document.querySelectorAll('[data-toggle]').forEach(b => b.onchange = () => {
    const t = data.tasks.find(x => x.id === b.dataset.toggle); if (!t) return;
    t.done = b.checked; save(); render(); if (t.done) toast('Nice! Done ✓');
  });
  document.querySelectorAll('.wday[data-day]').forEach(b => b.onclick = () => { cursor = parseDate(b.dataset.day); calMode = 'week'; pref.set('ld_calendar_mode', 'week'); setView('calendar'); });
  document.querySelectorAll('.mday[data-day], .wcol[data-day]').forEach(b => {
    const open = () => { cursor = parseDate(b.dataset.day); calMode = 'day'; pref.set('ld_calendar_mode', 'day'); renderCalendar(); };
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

/* Repeat options for the activity editor, rebuilt when the date or repeat type changes. */
function repeatOptionsHtml(form, o) {
  const repeat = form.repeat.value, dateStr = form.date.value;
  if (repeat === 'none' || !core.isDateKey(dateStr)) return '';
  const d = parseDate(dateStr), cur = name => form.querySelector(`[name="${name}"]`);
  const interval = Number(cur('interval')?.value || o?.interval || 1);
  const until = cur('until')?.value ?? o?.until ?? '';
  const untilOn = cur('untilMode') ? cur('untilMode').value === 'on' : !!o?.until;
  let html = '';
  if (repeat === 'daily') {
    html += field('How often', 'fInt', `<select id="fInt" name="interval">${[1, 2, 3].map(n => `<option value="${n}"${n === interval ? ' selected' : ''}>${n === 1 ? 'Every day' : `Every ${n} days`}</option>`).join('')}</select>`);
  }
  if (repeat === 'weekly') {
    const picked = form.querySelector('[name="days"]') ? [...form.querySelectorAll('[name="days"]:checked')].map(x => Number(x.value))
      : (o?.days?.length ? o.days.map(Number) : [d.getDay()]);
    html += field('How often', 'fInt', `<select id="fInt" name="interval">${[1, 2, 3, 4].map(n => `<option value="${n}"${n === interval ? ' selected' : ''}>${n === 1 ? 'Every week' : `Every ${n} weeks`}</option>`).join('')}</select>`)
      + `<div class="field"><span class="label" id="daysLbl">On</span><div class="daypick" role="group" aria-labelledby="daysLbl">${core.weekdayNames.map((n, i) =>
        `<label><input type="checkbox" name="days" value="${i}"${picked.includes(i) ? ' checked' : ''} aria-label="${n}"><span>${n.slice(0, 2)}</span></label>`).join('')}</div></div>`;
  }
  if (repeat === 'monthly') {
    const by = form.querySelector('[name="monthBy"]:checked')?.value || o?.monthBy || 'date';
    const dow = core.weekdayNames[d.getDay()], nth = core.ordinals[core.weekOfMonth(d) - 1];
    const opts = [['date', `On day ${d.getDate()}`]];
    if (core.weekOfMonth(d) <= 4) opts.push(['nth', `On the ${nth} ${dow}`]);
    if (core.isLastWeekdayOfMonth(d)) opts.push(['last', `On the last ${dow}`]);
    const sel = opts.some(x => x[0] === by) ? by : 'date';
    html += `<div class="field"><span class="label" id="mbLbl">Which day</span><div class="radios" role="radiogroup" aria-labelledby="mbLbl">${opts.map(([v, l]) =>
      `<label><input type="radio" name="monthBy" value="${v}"${v === sel ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></div>`;
  }
  html += `<div class="two">${field('Ends', 'fUntilMode', `<select id="fUntilMode" name="untilMode"><option value="never">Never</option><option value="on"${untilOn ? ' selected' : ''}>On a date</option></select>`)}
    ${untilOn ? field('Last day', 'fUntil', `<input id="fUntil" name="until" type="date" min="${esc(dateStr)}" value="${esc(until)}">`) : ''}</div>`;
  return html;
}

/* Read the activity form into a plain object (series fields included). */
function readEventForm(form) {
  const fd = new FormData(form), raw = Object.fromEntries(fd.entries());
  raw.title = (raw.title || '').trim();
  const out = { title: raw.title, kidId: raw.kidId || '', category: raw.category, date: raw.date, time: raw.time || '', endTime: raw.time ? (raw.endTime || '') : '',
    location: (raw.location || '').trim(), pickupBy: (raw.pickupBy || '').trim(), notes: raw.notes || '', repeat: raw.repeat || 'none' };
  if (out.repeat !== 'none') {
    out.interval = Number(raw.interval) || 1;
    if (out.repeat === 'weekly') out.days = fd.getAll('days').map(Number);
    if (out.repeat === 'monthly') out.monthBy = raw.monthBy || 'date';
    out.until = raw.untilMode === 'on' ? (raw.until || '') : '';
  }
  return out;
}

function openEditor(mode, id = null, day = null, on = null, time = null) {
  const list = mode === 'event' ? 'events' : mode === 'task' ? 'tasks' : 'kids';
  const o = id ? data[list].find(x => x.id === id) : null;
  if (id && !o) return;
  const noun = { event: 'activity', task: 'to-do', kid: 'child' }[mode];
  const series = mode === 'event' && o && core.ruleOf(o).repeat !== 'none';
  const occ = series && core.isDateKey(on) ? on : null;     // which day of the series was tapped
  let html = `<form id="editForm" novalidate><h2 id="sheetTitle">${o ? 'Edit' : 'New'} ${noun}</h2>`;
  if (mode === 'event') {
    const defaultKid = o ? o.kidId : (filter !== 'all' ? filter : '');
    html += field('What’s happening?', 'fTitle', `<input id="fTitle" name="title" maxlength="90" required placeholder="Soccer practice" value="${esc(o?.title)}" autofocus>`)
      + `<div class="two">${field('Who', 'fKid', `<select id="fKid" name="kidId">${kidOptions(defaultKid)}</select>`)}
        ${field('Type', 'fCat', `<select id="fCat" name="category">${CATEGORIES.map(([c, i]) => `<option value="${c}"${(o?.category || 'Other') === c ? ' selected' : ''}>${i} ${c}</option>`).join('')}</select>`)}</div>`
      + field('Date', 'fDate', `<input id="fDate" name="date" type="date" required value="${esc(occ || o?.date || day || todayKey())}">`)
      + `<div class="field"><label class="switch"><input type="checkbox" id="fAllDay"${o && !o.time ? ' checked' : ''}><span>All day</span></label></div>`
      + `<div class="two" id="timeRow">${field('Starts', 'fTime', `<input id="fTime" name="time" type="time" value="${esc(o?.time || time || '')}">`)}
        ${field('Ends (optional)', 'fEnd', `<input id="fEnd" name="endTime" type="time" value="${esc(o?.endTime)}">`)}</div>`
      + field('Repeats', 'fRep', `<select id="fRep" name="repeat">${[['none', 'Does not repeat'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']].map(([v, l]) => `<option value="${v}"${core.ruleOf(o || { date: todayKey() }).repeat === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`)
      + `<div id="repeatMore"></div>`
      + field('Where', 'fLoc', `<input id="fLoc" name="location" maxlength="120" placeholder="School gym" value="${esc(o?.location)}">`)
      + field('Pickup / drop-off', 'fPick', `<input id="fPick" name="pickupBy" maxlength="60" placeholder="Mom, Dad, carpool" value="${esc(o?.pickupBy)}">`)
      + field('Notes', 'fNotes', `<textarea id="fNotes" name="notes" maxlength="500" placeholder="Bring water bottle and shin guards">${esc(o?.notes)}</textarea>`);
    if (occ) html += `<div class="field scope"><span class="label" id="scopeLbl">This activity repeats. Change…</span><div class="radios" role="radiogroup" aria-labelledby="scopeLbl">
        <label><input type="radio" name="scope" value="one" checked><span>Only ${esc(fmtDay(occ, { weekday: 'short', month: 'short', day: 'numeric' }))}</span></label>
        <label><input type="radio" name="scope" value="all"><span>Every time</span></label></div></div>`;
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
  const fail = (msg, el) => { $('formError').textContent = msg; el?.focus(); };
  form.querySelector('[data-close]').onclick = closeSheet;

  if (mode === 'event') {
    const syncAllDay = () => { const on = $('fAllDay').checked; $('timeRow').classList.toggle('hidden', on); if (on) { form.time.value = ''; form.endTime.value = ''; } };
    $('fAllDay').onchange = syncAllDay; syncAllDay();
    const more = () => { $('repeatMore').innerHTML = repeatOptionsHtml(form, o); const um = $('fUntilMode'); if (um) um.onchange = more; };
    form.repeat.onchange = more; form.date.onchange = more; more();
  }

  form.onsubmit = ev => {
    ev.preventDefault();
    if (mode === 'event') {
      const item = readEventForm(form);
      if (!item.title) return fail('Give it a name.', form.title);
      if (!core.isDateKey(item.date)) return fail('Pick a date.', form.date);
      if (!$('fAllDay').checked && !item.time) return fail('Add a start time, or switch on All day.', form.time);
      if (item.endTime && item.endTime <= item.time) return fail('The end time needs to be after the start time.', form.endTime);
      if (item.repeat === 'weekly' && !item.days.length) return fail('Pick at least one day of the week.');
      if (item.until && item.until < item.date) return fail('The last day can’t be before the first day.', form.until);
      const scope = form.scope?.value;
      if (occ && scope === 'one') {
        const one = { ...item }; SERIES_FIELDS.forEach(f => delete one[f]);
        detachOccurrence(o, occ, one);
      } else if (o) {
        let keepSkip = o.skip;
        if (occ && item.date !== occ) {           // move the whole series by the same number of days
          const shift = daysBetween(parseDate(occ), parseDate(item.date));
          item.date = dateKey(plusDays(parseDate(o.date), shift));
          if (item.days) item.days = item.days.map(d => ((d + shift) % 7 + 7) % 7);
          keepSkip = null;                        // old skipped days no longer line up
        } else if (occ) item.date = o.date;       // editing from one day keeps the series start
        SERIES_FIELDS.forEach(f => delete o[f]);
        Object.assign(o, item);
        if (item.repeat !== 'none' && keepSkip?.length) o.skip = keepSkip;
      } else data.events.push({ id: uid(), ...item });
      save(); closeSheet(); render(); toast(o ? 'Saved' : 'Activity added');
      return;
    }
    const raw = Object.fromEntries(new FormData(form).entries());
    const req = mode === 'kid' ? 'name' : 'title';
    raw[req] = (raw[req] || '').trim();
    if (!raw[req]) return fail(mode === 'kid' ? 'Add a name.' : 'Give it a name.', form.querySelector(`[name=${req}]`));
    if (mode === 'kid') raw.color = Number(raw.color) || 0;
    if (mode === 'task') raw.done = o?.done || false;
    if (o) Object.assign(o, raw); else data[list].push({ id: uid(), ...raw });
    save(); closeSheet(); render(); toast(o ? 'Saved' : `${noun[0].toUpperCase() + noun.slice(1)} added`);
  };

  if (o) $('delItem').onclick = () => {
    if (occ && form.scope?.value === 'one') {
      if (!confirm(`Remove “${o.title}” on ${fmtDay(occ)} only?`)) return;
      detachOccurrence(o, occ, null);
    } else {
      if (!confirm(mode === 'kid' ? `Remove ${o.name}? Their activities and to-dos stay, assigned to the whole family.` : series ? `Delete every “${o.title}”?` : `Delete “${o.title}”?`)) return;
      data[list] = data[list].filter(x => x.id !== id);
      if (mode === 'kid') { data.events.forEach(x => { if (x.kidId === id) x.kidId = ''; }); data.tasks.forEach(x => { if (x.kidId === id) x.kidId = ''; }); if (filter === id) filter = 'all'; }
    }
    save(); closeSheet(); render(); toast('Deleted');
  };
  const copy = $('copyItem');
  if (copy) copy.onclick = () => { const c = { ...o, id: uid(), title: o.title + ' (copy)' }; data.events.push(c); save(); openEditor('event', c.id); toast('Duplicated'); };
}

/* ---------- Static bindings ---------- */
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
document.querySelectorAll('[data-quick-add]').forEach(b => b.onclick = openQuickAdd);
document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => openEditor(b.dataset.add));
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
  // Leaving Month view: land on today if it's in the month being shown.
  const now = new Date();
  if (calMode === 'month' && cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth()) cursor = now;
  calMode = b.dataset.mode; pref.set('ld_calendar_mode', calMode); renderCalendar();
});
const STEP = { day: 1, week: 7, list: 30 };
const stepCursor = dir => { cursor = calMode === 'month' ? new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1) : plusDays(cursor, dir * STEP[calMode]); renderCalendar(); };
$('calPrev').onclick = () => stepCursor(-1);
$('calNext').onclick = () => stepCursor(1);
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
setInterval(() => { if (view === 'today' && $('scrim').classList.contains('hidden')) render(); }, 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') render(); });

setView('today');
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
