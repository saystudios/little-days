/* Little Days reminders.
   iPhone/iPad app: scheduled with the system, so they arrive even when the app
   is closed (rescheduled whenever the planner changes or the app reopens).
   Website: shown only while the page is open — browsers can't do more reliably.

   Works like Home Preventive Maintenance: reminders are on whenever iOS allows
   notifications for Little Days, unless the parent turns them off here. The app
   asks iOS once, at a natural moment (after the first timed activity is added),
   and if iOS says no, it points to the Settings app — only the parent can
   change that setting there; the app can't override it. */
(function () {
  'use strict';
  const R = window.LittleDaysReminders;
  const mount = document.getElementById('remindersMount');
  if (!R || !mount) return;
  const N = () => window.littleDaysNative || {};
  const native = () => !!N().isNative;
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch { /* storage full */ } };
  // Older versions stored the minutes on their own.
  let prefs = R.prefsOf(read('ld_reminder_prefs', { minutes: Number(localStorage.getItem('ld_reminder_minutes')) || 10 }));
  // Only an explicit "turn off" by the parent is remembered. (Older builds saved
  // 'no' in ld_reminders whenever the permission check failed, so that key is ignored.)
  let off = localStorage.getItem('ld_reminders_off') === 'yes';
  const webSupported = 'Notification' in window;
  let status = 'checking';   // granted | denied | prompt | unavailable | checking
  let msgText = '', msgError = false;

  async function checkStatus() {
    if (native()) status = N().notificationStatus ? await N().notificationStatus() : 'unavailable';
    else if (!webSupported) status = 'unavailable';
    else status = Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'prompt';
    return status;
  }
  const active = () => !off && status === 'granted';
  // Tournament plan (Meal Plan → Sports meals) with "Remind me at each step" on:
  // a heads-up before each timed step plus a packing reminder the evening before.
  // (Older sports-planner entries no longer create reminders.)
  const sportsEvents = () => {
    try {
      const t = JSON.parse(localStorage.getItem('ld_sports_meals_v1') || '{}').tourSchedule;
      if (!t || !t.remind || !/^\d{4}-\d{2}-\d{2}$/.test(t.date || '') || !Array.isArray(t.items)) return [];
      const steps = t.items.filter(i => i && /^\d{2}:\d{2}$/.test(i.time || '') && i.what)
        .map(i => ({ id: 'tkd-' + i.id, title: String(i.what).slice(0, 80), sport: t.title || 'Tournament', kind: 'Step', date: t.date, time: i.time }));
      return [{ id: 'tkd-pack', title: t.title || 'the tournament', kind: 'Tournament', date: t.date, time: '' }, ...steps];
    } catch { return []; }
  };
  const planner = () => (typeof data === 'object' && data ? data : null);

  const switchHtml = (id, label, checked) => `<label class="switch"><input type="checkbox" id="${id}"${checked ? ' checked' : ''}><span>${label}</span></label>`;
  const statusLine = () => {
    if (status === 'checking') return '<p class="note">Checking notification permission…</p>';
    if (status === 'unavailable') return native()
      ? '<p class="note">Reminders aren’t available in this version of the app. Please update Little Days from TestFlight or the App Store.</p>'
      : '<p class="note">This browser can’t show notifications. The iPhone and iPad app can.</p>';
    if (status === 'denied') return native()
      ? `<p class="note">Notifications for Little Days are turned off in your iPhone or iPad settings. Little Days can’t change that itself — open Settings, tap <b>Notifications</b>, then turn on <b>Allow Notifications</b>.</p>
         <div class="settings-row"><button class="ghost" id="remSettings" type="button">Open iPhone Settings</button></div>`
      : '<p class="note">Notifications are blocked for this site. Allow them in your browser’s site settings, then come back.</p>';
    if (status === 'prompt') return `<p class="note">Get a heads-up before activities and birthdays${native() ? ', even when Little Days is closed' : ''}.</p>
         <div class="settings-row"><button class="primary" id="remAsk" type="button">Turn on reminders</button></div>`;
    return `<div class="field">${switchHtml('remOn', off ? 'Reminders are off on this device' : '🔔 Reminders are on', !off)}
      <p class="note">${native() ? 'They arrive even when Little Days is closed (iPhone Focus and notification settings still apply).' : 'On the website, reminders only appear while this page is open. The iPhone and iPad app can remind you even when it’s closed.'}</p></div>`;
  };

  function draw() {
    const showMore = active();
    mount.innerHTML = `<div class="panel"><h3>Reminders</h3>${statusLine()}
      <div id="remMore"${showMore ? '' : ' hidden'}>
        <div class="field"><label for="remPreset">Quick reminder preset</label><select id="remPreset" class="ghost"><option value="">Custom</option><option value="school">School · 30 minutes before</option><option value="sports">Sports · 60 minutes before</option><option value="soon">Coming up · 10 minutes before</option></select></div>
        <div class="field">${switchHtml('remAct', 'Before activities', prefs.activities)}
          <select id="remMin" class="ghost" aria-label="How long before">${[5, 10, 15, 30, 60, 120].map(m => `<option value="${m}"${m === Number(prefs.minutes) ? ' selected' : ''}>${m < 60 ? m + ' minutes' : m / 60 + (m === 60 ? ' hour' : ' hours')} before</option>`).join('')}</select></div>
        <div class="field">${switchHtml('remBday', 'Birthdays', prefs.birthdays)}</div>
        <div class="field">${switchHtml('remSum', 'Morning summary of the day', prefs.summary)}
          <label class="inline-time">at <input type="time" id="remSumTime" value="${prefs.summaryTime}"></label></div>
        <div class="field">${switchHtml('remQuiet', 'Quiet hours (no reminders)', prefs.quiet)}
          <span class="inline-time"><label>from <input type="time" id="remQs" value="${prefs.quietStart}"></label> <label>to <input type="time" id="remQe" value="${prefs.quietEnd}"></label></span></div>
        <div class="settings-row"><button class="ghost" id="remTest" type="button">Send test notification</button></div>
        <p class="note" id="remCount"></p>
      </div>
      <p class="cloud-msg${msgError ? ' error' : ''}" id="remMsg" role="status">${msgText}</p></div>`;
    const $ = id => document.getElementById(id);
    const msg = (t, err) => { msgText = t; msgError = !!err; const m = $('remMsg'); if (m) { m.textContent = t; m.classList.toggle('error', !!err); } };

    if ($('remAsk')) $('remAsk').onclick = async () => {
      const s = await ask();
      if (s === 'granted') msg('Reminders are on.');
      else if (s === 'denied') msg(native() ? 'iOS didn’t allow notifications. You can turn them on in Settings.' : 'Notifications were blocked for this site.', true);
    };
    if ($('remSettings')) $('remSettings').onclick = async () => {
      if (!(await N().openAppSettings?.())) msg('Open the Settings app → Little Days → Notifications.', true);
    };
    if ($('remOn')) $('remOn').onchange = async e => {
      off = !e.target.checked; write('ld_reminders_off', off ? 'yes' : 'no');
      msgText = off ? 'Reminders are off on this device.' : 'Reminders are on.'; msgError = false;
      draw(); await apply();
    };
    if (!showMore) return;
    const save = () => {
      prefs = { ...prefs, activities: $('remAct').checked, minutes: Number($('remMin').value), birthdays: $('remBday').checked,
        summary: $('remSum').checked, summaryTime: $('remSumTime').value || '07:00', quiet: $('remQuiet').checked,
        quietStart: $('remQs').value || '21:30', quietEnd: $('remQe').value || '06:30' };
      write('ld_reminder_prefs', prefs); apply(); msg('Saved');
    };
    ['remAct', 'remMin', 'remBday', 'remSum', 'remSumTime', 'remQuiet', 'remQs', 'remQe'].forEach(id => { $(id).onchange = save; });
    $('remPreset').onchange = e => {
      const minutes = { school: 30, sports: 60, soon: 10 }[e.target.value];
      if (!minutes) return;
      $('remAct').checked = true;
      $('remMin').value = String(minutes);
      save();
    };
    $('remTest').onclick = async () => {
      const ok = await testReminder();
      msg(ok ? (native() ? 'A test notification will arrive in 5 seconds — you can lock your phone or close the app.' : 'Test notification sent.')
        : 'Couldn’t send a test notification. Check that notifications are allowed for Little Days.', !ok);
    };
    showCount();
  }
  async function showCount() {
    const el = document.getElementById('remCount');
    if (!el || !native() || !N().pendingCount) return;
    const n = await N().pendingCount();
    el.textContent = n ? `${n} upcoming reminder${n === 1 ? '' : 's'} scheduled on this ${/iPad/.test(navigator.userAgent) ? 'iPad' : 'device'}.` : '';
  }

  /* Ask iOS (or the browser). iOS only shows its prompt once per install. */
  async function ask() {
    write('ld_reminders_asked', 'yes');
    if (native()) status = N().requestNotificationsStatus ? await N().requestNotificationsStatus() : 'unavailable';
    else if (webSupported) { await Notification.requestPermission(); await checkStatus(); }
    if (status === 'granted' && off) { off = false; write('ld_reminders_off', 'no'); }
    draw(); await apply();
    return status;
  }
  async function testReminder() {
    const n = { id: N().TEST_ID || 2147480001, key: 'test', title: 'Little Days reminders are on', body: 'You’ll get reminders like this before activities.', at: new Date(Date.now() + 5000) };
    if (native()) return !!(await N().scheduleNotifications?.([n], { keep: true }));
    if (!webSupported || Notification.permission !== 'granted') return false;
    setTimeout(() => new Notification(n.title, { body: n.body }), 5000); return true;
  }

  /* Reschedule everything from the current planner and Sports & Meals. */
  let timer = null;
  function apply() {
    clearTimeout(timer);
    return new Promise(resolve => {
      timer = setTimeout(async () => {
        const p = planner();
        const list = active() && p ? R.build(p, { prefs, sports: sportsEvents() }) : [];
        if (native()) { await N().scheduleNotifications?.(list); showCount(); }
        resolve(list);
      }, 300);
    });
  }
  /* App reopened: the parent may have changed notifications in Settings. */
  async function refresh() {
    const before = status;
    await checkStatus();
    if (status !== before) { msgText = ''; msgError = false; draw(); }
    return apply();
  }

  /* Like Home Preventive Maintenance: ask once, right after the first timed
     activity (or sports event) is added — not on first launch. */
  async function maybeAsk() {
    if (!native() || off || localStorage.getItem('ld_reminders_asked') === 'yes' || status !== 'prompt') return;
    const p = planner();
    const hasTimed = (p?.events || []).some(e => e && e.time);
    if (hasTimed) await ask();
  }
  window.littleDaysReminders = { apply, refresh, ask, prefs: () => prefs, enabled: () => active(), status: () => status };
  window.addEventListener('littledays:saved', () => { maybeAsk(); });
  window.addEventListener('little-days-sports-remote', () => apply());

  // Website: show what's due while the page is open.
  const shown = new Set();
  setInterval(() => {
    if (native() || !active() || !webSupported || Notification.permission !== 'granted' || !planner()) return;
    const now = Date.now();
    for (const n of R.build(planner(), { prefs, sports: sportsEvents(), now: new Date(now - 60000) })) {
      if (n.at.getTime() > now) break;
      if (shown.has(n.key)) continue;
      shown.add(n.key); new Notification(n.title, { body: n.body, tag: n.key });
    }
  }, 30000);

  draw();
  const start = async () => { await checkStatus(); draw(); apply(); };
  document.addEventListener('littledays:native-ready', start);
  start();
})();
