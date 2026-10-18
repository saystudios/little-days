/* Little Days: "Scan a flyer or screenshot".
   The parent picks or takes a photo; it's shrunk on the device, read by AI on the
   Little Days server (supabase/functions/scan-event) and comes back as activity
   drafts. One activity opens in the normal editor to check and save; several
   show as a checklist. Nothing is saved without the parent tapping a button.
   Uses app.js globals: data, save, render, toast, openSheet, closeSheet,
   openEditor, esc, uid, kidBy, nameOf, avatar, fmtDay, fmtRange, todayKey, setView. */
(function () {
  'use strict';
  const S = window.LittleDaysScanCore;
  if (!S) return;
  const $ = id => document.getElementById(id);

  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.hidden = true;
  input.setAttribute('aria-hidden', 'true');
  document.body.append(input);
  let run = 0;   // bumps on every scan so a cancelled one is ignored when it returns

  function start() {
    if (!window.littleDaysCloud?.canScan()) return needSync();
    input.value = '';
    input.click();
  }

  function needSync() {
    openSheet(`<h2 id="sheetTitle">Turn on family sync to scan</h2>
      <p class="sub">Scanning reads your photo with AI on the Little Days server, so it needs you signed in to family sync. Turn it on in Settings → Family sync.</p>
      <div class="sheet-actions"><span></span><div class="end"><button class="btn" type="button" data-close>Not now</button><button class="btn primary" type="button" data-settings>Open Settings</button></div></div>`);
    $('sheet').querySelector('[data-close]').onclick = closeSheet;
    $('sheet').querySelector('[data-settings]').onclick = () => { closeSheet(); setView('settings'); };
  }

  /* Shrink the photo and re-encode it as JPEG (also turns iPhone HEIC into something the AI reads). */
  function prepare(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const { width, height } = S.fitSize(img.naturalWidth, img.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);   // transparent screenshots → white
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({ dataUrl, base64: dataUrl.slice(dataUrl.indexOf(',') + 1) });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file couldn’t be opened. Choose a photo or screenshot.')); };
      img.src = url;
    });
  }

  function busy(preview, id) {
    openSheet(`<h2 id="sheetTitle">Reading your photo…</h2>
      <div class="scan-busy" role="status">${preview ? `<img src="${preview}" alt="">` : ''}<span class="scan-spinner" aria-hidden="true"></span><p class="sub">Looking for dates, times and places. This usually takes a few seconds.</p></div>
      <div class="sheet-actions"><span></span><div class="end"><button class="btn" type="button" data-close>Cancel</button></div></div>`);
    $('sheet').querySelector('[data-close]').onclick = () => { if (run === id) run++; closeSheet(); };
  }

  function problem(title, message) {
    openSheet(`<h2 id="sheetTitle">${esc(title)}</h2><p class="sub">${esc(message)}</p>
      <div class="sheet-actions"><button class="btn" type="button" data-manual>Add by hand</button><div class="end"><button class="btn" type="button" data-close>Close</button><button class="btn primary" type="button" data-again>Try another photo</button></div></div>`);
    $('sheet').querySelector('[data-close]').onclick = closeSheet;
    $('sheet').querySelector('[data-manual]').onclick = () => openEditor('event');
    $('sheet').querySelector('[data-again]').onclick = start;
  }

  const leftNote = n => typeof n === 'number' && n <= 5 ? `<p class="note">${n === 0 ? 'That was your last scan for today.' : `${n} scan${n === 1 ? '' : 's'} left today.`}</p>` : '';

  function choose(drafts, remaining) {
    const rows = drafts.map((d, i) => {
      const dup = S.isDuplicate(d, data.events), kid = kidBy(d.kidId);
      return `<li><label class="scan-row">
        <input type="checkbox" name="pick" value="${i}"${dup ? '' : ' checked'}>
        ${avatar(kid)}
        <span class="scan-what"><b>${esc(d.title)}</b>
          <small>${esc(fmtDay(d.date))} · ${esc(fmtRange(d))}${d.repeat === 'weekly' ? ' · repeats' : ''}${d.location ? ' · ' + esc(d.location) : ''}</small>
          <small>${esc(nameOf(kid))}${dup ? ' · <em>Already in your planner</em>' : ''}</small></span>
      </label></li>`;
    }).join('');
    openSheet(`<form id="scanForm"><h2 id="sheetTitle">Found ${drafts.length} activities</h2>
      <p class="sub">Untick any you don’t want. You can change any of them after adding.</p>
      <ul class="scan-list">${rows}</ul>${leftNote(remaining)}
      <p class="cloud-msg error" id="scanError" role="alert"></p>
      <div class="sheet-actions"><span></span><div class="end"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="submit" id="scanAdd">Add</button></div></div></form>`);
    const form = $('scanForm'), add = $('scanAdd');
    const picked = () => [...form.querySelectorAll('[name="pick"]:checked')].map(x => drafts[Number(x.value)]);
    const label = () => { const n = picked().length; add.textContent = n ? `Add ${n}` : 'Add'; add.disabled = !n; };
    form.onchange = label; label();
    form.querySelector('[data-close]').onclick = closeSheet;
    form.onsubmit = ev => {
      ev.preventDefault();
      const list = picked();
      if (!list.length) { $('scanError').textContent = 'Tick at least one activity.'; return; }
      list.forEach(d => data.events.push({ id: uid(), ...d }));
      save(); closeSheet(); render();
      toast(list.length === 1 ? 'Activity added' : `${list.length} activities added`);
    };
  }

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const id = ++run;
    let photo;
    try { photo = await prepare(file); }
    catch (e) { return problem('Couldn’t open that photo', e.message); }
    busy(photo.dataUrl, id);
    try {
      const res = await window.littleDaysCloud.scan({
        image: photo.base64, mediaType: 'image/jpeg', today: todayKey(),
        weekday: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
        kids: data.kids.map(k => k.name)
      });
      if (id !== run) return;                      // cancelled while waiting
      const drafts = S.toDrafts(res?.events, data.kids);
      if (!drafts.length) return problem('No activities found', 'We couldn’t find a date in that photo. Try a clearer photo, or crop it so the date and time are easy to see.');
      if (drafts.length === 1) {
        openEditor('event', null, null, null, null, drafts[0]);
        if (S.isDuplicate(drafts[0], data.events)) toast('Heads up: this looks like it’s already in your planner');
        return;
      }
      choose(drafts, res.remaining);
    } catch (e) {
      if (id !== run) return;
      if (e.code === 'limit') return problem('That’s all the scans for today', e.message);
      if (e.code === 'no_family' || e.code === 'signed_out') return needSync();
      problem('Couldn’t scan that photo', e.message || 'Something went wrong. Try again in a minute.');
    }
  };

  window.littleDaysScan = { start };
})();
