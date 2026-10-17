/* Little Days reminders.
   iPhone/iPad app: scheduled with the system, so they arrive even when the app
   is closed (rescheduled whenever the planner changes or the app reopens).
   Website: shown only while the page is open — browsers can't do more reliably. */
(function () {
  'use strict';
  const R = window.LittleDaysReminders;
  const mount = document.getElementById('remindersMount');
  if (!R || !mount) return;
  const native = () => window.littleDaysNative?.isNative;
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full */ } };
  // Older versions stored the minutes on their own.
  let prefs = R.prefsOf(read('ld_reminder_prefs', { minutes: Number(localStorage.getItem('ld_reminder_minutes')) || 10 }));
  let on = localStorage.getItem('ld_reminders') === 'yes';
  const webSupported = 'Notification' in window;

  const switchHtml = (id, label, checked) => `<label class="switch"><input type="checkbox" id="${id}"${checked ? ' checked' : ''}><span>${label}</span></label>`;
  function draw() {
    const where = native() ? 'They arrive even when Little Days is closed.'
      : webSupported ? 'On the website, reminders only appear while this page is open. The iPhone and iPad app can remind you even when it’s closed.'
      : 'This browser can’t show notifications. The iPhone and iPad app can.';
    mount.innerHTML = `<div class="panel"><h3>Reminders</h3>
      <div class="field">${switchHtml('remOn', 'Remind me on this device', on)}<p class="note">${where}</p></div>
      <div id="remMore"${on ? '' : ' hidden'}>
        <div class="field">${switchHtml('remAct', 'Before activities', prefs.activities)}
          <select id="remMin" class="ghost" aria-label="How long before">${[5, 10, 15, 30, 60, 120].map(m => `<option value="${m}"${m === Number(prefs.minutes) ? ' selected' : ''}>${m < 60 ? m + ' minutes' : m / 60 + (m === 60 ? ' hour' : ' hours')} before</option>`).join('')}</select></div>
        <div class="field">${switchHtml('remBday', 'Birthdays', prefs.birthdays)}</div>
        <div class="field">${switchHtml('remSum', 'Morning summary of the day', prefs.summary)}
          <label class="inline-time">at <input type="time" id="remSumTime" value="${prefs.summaryTime}"></label></div>
        <div class="field">${switchHtml('remQuiet', 'Quiet hours (no reminders)', prefs.quiet)}
          <span class="inline-time"><label>from <input type="time" id="remQs" value="${prefs.quietStart}"></label> <label>to <input type="time" id="remQe" value="${prefs.quietEnd}"></label></span></div>
        <div class="settings-row"><button class="ghost" id="remTest" type="button">Send a test reminder</button></div>
      </div>
      <p class="cloud-msg" id="remMsg" role="status"></p></div>`;
    const $ = id => document.getElementById(id), msg = (t, err) => { $('remMsg').textContent = t; $('remMsg').classList.toggle('error', !!err); };
    $('remOn').onchange = async e => {
      if (!e.target.checked) { on = false; localStorage.setItem('ld_reminders', 'no'); await apply(); return draw(); }
      const ok = await permission();
      on = ok; localStorage.setItem('ld_reminders', ok ? 'yes' : 'no');
      draw(); if (!ok) document.getElementById('remMsg').textContent = native()
        ? 'Notifications are off for Little Days. Turn them on in the Settings app → Little Days → Notifications.'
        : 'Notifications are blocked for this site. Allow them in your browser’s site settings.';
      await apply();
    };
    const save = () => {
      prefs = { ...prefs, activities: $('remAct').checked, minutes: Number($('remMin').value), birthdays: $('remBday').checked,
        summary: $('remSum').checked, summaryTime: $('remSumTime').value || '07:00', quiet: $('remQuiet').checked,
        quietStart: $('remQs').value || '21:30', quietEnd: $('remQe').value || '06:30' };
      write('ld_reminder_prefs', prefs); apply(); msg('Saved');
    };
    if (on) ['remAct', 'remMin', 'remBday', 'remSum', 'remSumTime', 'remQuiet', 'remQs', 'remQe'].forEach(id => { $(id).onchange = save; });
    if (on) $('remTest').onclick = async () => {
      const ok = await testReminder();
      msg(ok ? (native() ? 'A test reminder will arrive in 5 seconds — you can close the app.' : 'Test reminder sent.') : 'Couldn’t send a test reminder.', !ok);
    };
  }

  async function permission() {
    if (native()) return window.littleDaysNative.requestNotifications();
    if (!webSupported) return false;
    return (await Notification.requestPermission()) === 'granted';
  }
  async function testReminder() {
    const n = { id: 1, title: 'Little Days reminders are on', body: 'You’ll get reminders like this before activities.', at: new Date(Date.now() + 5000) };
    if (native()) return window.littleDaysNative.scheduleNotifications([n], { keep: true });
    if (!webSupported || Notification.permission !== 'granted') return false;
    new Notification(n.title, { body: n.body }); return true;
  }

  /* Reschedule everything from the current planner. */
  let timer = null;
  function apply() {
    clearTimeout(timer);
    return new Promise(resolve => {
      timer = setTimeout(async () => {
        const list = on && typeof data === 'object' ? R.build(data, { prefs }) : [];
        if (native()) await window.littleDaysNative.scheduleNotifications(list);
        resolve(list);
      }, 300);
    });
  }
  window.littleDaysReminders = { apply, prefs: () => prefs, enabled: () => on };

  // Website: show what's due while the page is open.
  const shown = new Set();
  setInterval(() => {
    if (native() || !on || !webSupported || Notification.permission !== 'granted' || typeof data !== 'object') return;
    const now = Date.now();
    for (const n of R.build(data, { prefs, now: new Date(now - 60000) })) {
      if (n.at.getTime() > now) break;
      if (shown.has(n.key)) continue;
      shown.add(n.key); new Notification(n.title, { body: n.body, tag: n.key });
    }
  }, 30000);

  draw();
  document.addEventListener('littledays:native-ready', () => { draw(); apply(); });
  apply();
})();
