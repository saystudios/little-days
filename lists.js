/* Little Days shared family lists: groceries, school supplies, packing, errands…
   Each list and each entry is its own synced item, so two people can tick off
   the same grocery list in the store at once.
     lists:     [{ id, title, emoji }]
     listItems: [{ id, listId, text, done, who }]   who = child id or ''        */
'use strict';
const LIST_TEMPLATES = [
  ['Groceries', '🛒'], ['School supplies', '✏️'], ['Packing', '🧳'], ['Household', '🏠'], ['Party planning', '🎉'], ['Errands', '🚗']
];
const ensureLists = () => { if (!Array.isArray(data.lists)) data.lists = []; if (!Array.isArray(data.listItems)) data.listItems = []; };

function renderLists() {
  const box = $('listsArea'); if (!box) return;
  ensureLists();
  const kidName = id => kidBy(id)?.name || '';
  box.innerHTML = data.lists.map(l => {
    const items = data.listItems.filter(i => i.listId === l.id && (filter === 'all' || !i.who || i.who === filter));
    const open = items.filter(i => !i.done), done = items.filter(i => i.done);
    const row = i => { const k = kidBy(i.who); return `<div class="todo ${colorClass(k)}${i.done ? ' done' : ''}">
      <input type="checkbox" class="check" data-li-toggle="${esc(i.id)}"${i.done ? ' checked' : ''} aria-label="${esc(i.text)}">
      <div class="label"><span>${esc(i.text)}</span>${i.who ? `<small>${esc(kidName(i.who))}</small>` : ''}</div>
      <button class="icon-btn" data-li-edit="${esc(i.id)}" aria-label="Edit ${esc(i.text)}">${icon('i-pencil', 18)}</button></div>`; };
    return `<section class="card list-card" aria-label="${esc(l.title)}">
      <div class="card-head"><h2>${esc(l.emoji || '📝')} ${esc(l.title)}</h2><button class="link-btn" data-list-edit="${esc(l.id)}">Edit</button></div>
      <form class="cloud-form add-item" data-list-add="${esc(l.id)}"><label class="sr-only" for="add-${esc(l.id)}">Add to ${esc(l.title)}</label>
        <input id="add-${esc(l.id)}" name="text" maxlength="80" autocomplete="off" placeholder="Add an item"><button class="btn small primary" type="submit">Add</button></form>
      ${open.map(row).join('') || (done.length ? '' : '<p class="empty">Nothing on this list yet.</p>')}
      ${done.length ? `<details class="done-items"><summary>${done.length} checked off</summary>${done.map(row).join('')}<div class="row-actions"><button class="btn small" data-list-clear="${esc(l.id)}">Clear checked items</button></div></details>` : ''}
    </section>`;
  }).join('');
}

function openListEditor(id) {
  ensureLists();
  const o = id ? data.lists.find(l => l.id === id) : null;
  const unused = LIST_TEMPLATES.filter(([t]) => !data.lists.some(l => l.title === t));
  openSheet(`<form id="lForm" novalidate><h2 id="sheetTitle">${o ? 'Edit list' : 'New list'}</h2>
    ${!o && unused.length ? `<div class="field"><span class="label">Quick start</span><div class="ideas">${unused.map(([t, e]) => `<button type="button" class="idea" data-title="${esc(t)}" data-emoji="${e}">${e} ${esc(t)}</button>`).join('')}</div></div>` : ''}
    <div class="two">${field('List name', 'lTitle', `<input id="lTitle" name="title" maxlength="40" required placeholder="Groceries" value="${esc(o?.title)}" autofocus>`)}
      ${field('Picture', 'lEmoji', `<input id="lEmoji" name="emoji" maxlength="4" value="${esc(o?.emoji || '📝')}">`)}</div>
    <p class="cloud-msg error" id="formError" role="alert"></p>
    <div class="sheet-actions">${o ? '<button type="button" class="btn danger" id="lDel">Delete list</button>' : '<span></span>'}<div class="end"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Save</button></div></div></form>`);
  const form = $('lForm');
  form.querySelectorAll('.idea').forEach(b => b.onclick = () => { form.title.value = b.dataset.title; form.emoji.value = b.dataset.emoji; });
  form.querySelector('[data-close]').onclick = closeSheet;
  form.onsubmit = ev => {
    ev.preventDefault();
    const title = form.title.value.trim();
    if (!title) { $('formError').textContent = 'Give the list a name.'; return form.title.focus(); }
    const fields = { title, emoji: form.emoji.value.trim() || '📝' };
    if (o) Object.assign(o, fields); else data.lists.push({ id: uid(), ...fields });
    save(); closeSheet(); render(); toast(o ? 'Saved' : 'List added');
  };
  if (o) $('lDel').onclick = () => {
    if (!confirm(`Delete the ${o.title} list and everything on it?`)) return;
    data.lists = data.lists.filter(l => l.id !== id); data.listItems = data.listItems.filter(i => i.listId !== id);
    save(); closeSheet(); render(); toast('List deleted');
  };
}

function openListItemEditor(id) {
  const o = data.listItems.find(i => i.id === id); if (!o) return;
  openSheet(`<form id="liForm" novalidate><h2 id="sheetTitle">Edit item</h2>
    ${field('Item', 'liText', `<input id="liText" name="text" maxlength="80" value="${esc(o.text)}" autofocus>`)}
    ${field('Who’s getting it', 'liWho', `<select id="liWho" name="who"><option value="">Anyone</option>${data.kids.map(k => `<option value="${esc(k.id)}"${o.who === k.id ? ' selected' : ''}>${esc(k.emoji)} ${esc(k.name)}</option>`).join('')}</select>`)}
    <p class="cloud-msg error" id="formError" role="alert"></p>
    <div class="sheet-actions"><button type="button" class="btn danger" id="liDel">Remove</button><div class="end"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Save</button></div></div></form>`);
  const form = $('liForm');
  form.querySelector('[data-close]').onclick = closeSheet;
  form.onsubmit = ev => {
    ev.preventDefault();
    const text = form.text.value.trim();
    if (!text) { $('formError').textContent = 'Type the item.'; return form.text.focus(); }
    Object.assign(o, { text, who: form.who.value }); save(); closeSheet(); render();
  };
  $('liDel').onclick = () => { data.listItems = data.listItems.filter(i => i.id !== id); save(); closeSheet(); render(); };
}

document.addEventListener('submit', ev => {
  const f = ev.target.closest('[data-list-add]'); if (!f) return;
  ev.preventDefault();
  const text = f.text.value.trim(); if (!text) return;
  ensureLists();
  data.listItems.push({ id: uid(), listId: f.dataset.listAdd, text, done: false, who: filter !== 'all' ? filter : '' });
  save(); render();
  $('add-' + f.dataset.listAdd)?.focus();   // keep typing the next item
});
document.addEventListener('change', ev => {
  const t = ev.target.closest('[data-li-toggle]'); if (!t) return;
  const i = data.listItems.find(x => x.id === t.dataset.liToggle); if (!i) return;
  i.done = t.checked; save(); render();
});
document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-list-edit],[data-li-edit],[data-list-new],[data-list-clear]'); if (!t) return;
  if (t.dataset.listEdit) return openListEditor(t.dataset.listEdit);
  if (t.dataset.liEdit) return openListItemEditor(t.dataset.liEdit);
  if ('listNew' in t.dataset) return openListEditor(null);
  if (t.dataset.listClear) { data.listItems = data.listItems.filter(i => !(i.listId === t.dataset.listClear && i.done)); save(); render(); toast('Cleared'); }
});
