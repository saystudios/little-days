/* Little Days on iPhone and iPad (Capacitor). Does nothing on the website.
   - System notifications for reminders (arrive even when the app is closed)
   - A copy of the planner and sync queue in native app storage, restored if iOS
     ever clears the web view's storage to free space
   - Haptic taps, status bar matching the theme, launch screen, keyboard,
     refresh when the app returns to the foreground                            */
(function () {
  'use strict';
  const Cap = window.Capacitor;
  const isNative = !!Cap?.isNativePlatform?.();
  const api = { isNative, tap() {}, success() {}, notificationStatus: async () => 'unavailable', requestNotifications: async () => false,
    scheduleNotifications: async () => false, openAppSettings: async () => false, TEST_ID: 2147480001 };
  window.littleDaysNative = api;
  if (!isNative) return;

  const plugin = name => { try { return Cap.registerPlugin(name); } catch { return null; } };
  const Prefs = plugin('Preferences'), Notes = plugin('LocalNotifications'), Haptics = plugin('Haptics'),
    StatusBar = plugin('StatusBar'), Splash = plugin('SplashScreen'), App = plugin('App'), Keyboard = plugin('Keyboard'),
    Launcher = plugin('AppLauncher');
  const has = name => { try { return Cap.isPluginAvailable ? Cap.isPluginAvailable(name) : true; } catch { return true; } };
  const quiet = p => p?.catch?.(() => {});
  document.documentElement.classList.add('native');

  /* ---------- Storage backup ---------- */
  const BACKUP = 'ld_backup';
  const ourKey = k => k === 'littledays_v1' || k.startsWith('littledays_') || k.startsWith('ld_');
  function snapshot() {
    const all = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (ourKey(k)) all[k] = localStorage.getItem(k); }
    return all;
  }
  let backupTimer = null;
  const backupSoon = () => { clearTimeout(backupTimer); backupTimer = setTimeout(backupNow, 1500); };
  const backupNow = () => Prefs && quiet(Prefs.set({ key: BACKUP, value: JSON.stringify({ at: Date.now(), keys: snapshot() }) }));
  async function restoreIfCleared() {
    if (!Prefs || localStorage.getItem('littledays_v1')) return false;
    const { value } = await Prefs.get({ key: BACKUP }).catch(() => ({}));
    if (!value) return false;
    const { keys } = JSON.parse(value);
    if (!keys?.littledays_v1) return false;
    for (const [k, v] of Object.entries(keys)) localStorage.setItem(k, v);
    location.reload();
    return true;
  }

  /* ---------- Notifications ----------
     iOS decides: the app can ask once ('prompt'); after "Don't Allow" only the
     Settings app can turn notifications back on, so we offer a button there. */
  const notesReady = () => !!Notes && has('LocalNotifications');
  /* 'granted' | 'denied' | 'prompt' | 'unavailable' (plugin missing from this build). */
  api.notificationStatus = async () => {
    if (!notesReady()) return 'unavailable';
    try {
      const { display } = await Notes.checkPermissions();
      return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
    } catch (e) { console.warn('Reminders: permission check failed', e); return 'unavailable'; }
  };
  /* Shows the iOS prompt when iOS still allows it. Returns the resulting status. */
  api.requestNotificationsStatus = async () => {
    const cur = await api.notificationStatus();
    if (cur !== 'prompt') return cur;
    try {
      const { display } = await Notes.requestPermissions();
      return display === 'granted' ? 'granted' : 'denied';
    } catch (e) { console.warn('Reminders: permission request failed', e); return api.notificationStatus(); }
  };
  api.requestNotifications = async () => (await api.requestNotificationsStatus()) === 'granted';
  /* Opens Settings → Little Days (where Notifications can be switched on). */
  api.openAppSettings = async () => {
    try { if (Launcher && has('AppLauncher')) { await Launcher.openUrl({ url: 'app-settings:' }); return true; } } catch (e) { console.warn('Open settings', e); }
    try { location.href = 'app-settings:'; return true; } catch { return false; }
  };
  /* Replace every pending Little Days reminder with this list (keep: add only).
     The test notification is left alone so a reschedule can't cancel it. */
  api.scheduleNotifications = async (list, { keep = false } = {}) => {
    if (!notesReady()) return false;
    try {
      if ((await Notes.checkPermissions()).display !== 'granted') return false;
      if (!keep) {
        const { notifications = [] } = await Notes.getPending();
        const old = notifications.filter(n => Number(n.id) !== api.TEST_ID);
        if (old.length) await Notes.cancel({ notifications: old.map(n => ({ id: n.id })) });
      }
      if (list.length) await Notes.schedule({ notifications: list.map(n => ({
        id: n.id, title: n.title, body: n.body || '', schedule: { at: n.at, allowWhileIdle: true }, extra: { key: n.key || '' }
      })) });
      return true;
    } catch (e) { console.warn('Reminders', e); return false; }
  };
  api.pendingCount = async () => {
    if (!notesReady()) return 0;
    try { return (await Notes.getPending()).notifications?.length || 0; } catch { return 0; }
  };
  // Tapping a reminder opens Today (sports reminders open Sports & Meals).
  quiet(Notes?.addListener?.('localNotificationActionPerformed', ev => {
    const key = ev?.notification?.extra?.key || '';
    if (/^s[ap]\|/.test(key) && window.littleDaysSportsMeals?.open) window.littleDaysSportsMeals.open('sports');
    else if (typeof setView === 'function') setView('today');
  }));

  /* ---------- Haptics ---------- */
  api.tap = () => quiet(Haptics?.impact({ style: 'LIGHT' }));
  api.success = () => quiet(Haptics?.notification({ type: 'SUCCESS' }));
  document.addEventListener('change', e => { if (e.target.matches?.('.check, .switch input')) api.tap(); }, true);
  document.addEventListener('click', e => { if (e.target.closest?.('.km-step, .km-kid, .key, .fab, .daypick label, .starpick label')) api.tap(); }, true);

  /* ---------- Status bar follows light/dark ---------- */
  const dark = () => document.documentElement.dataset.theme === 'dark' ||
    (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  const syncBar = () => quiet(StatusBar?.setStyle({ style: dark() ? 'DARK' : 'LIGHT' }));
  new MutationObserver(syncBar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', syncBar);

  /* ---------- Keyboard: keep the field being typed in visible ---------- */
  quiet(Keyboard?.setAccessoryBarVisible?.({ isVisible: true }));
  document.addEventListener('focusin', e => {
    if (e.target.matches?.('input, textarea, select')) setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  });

  /* ---------- App lifecycle ---------- */
  quiet(App?.addListener?.('appStateChange', ({ isActive }) => {
    if (isActive) {
      if (typeof render === 'function') render();
      window.littleDaysSync?.refresh?.();
      window.littleDaysReminders?.refresh?.();
    } else backupNow();
  }));

  window.addEventListener('littledays:saved', backupSoon);
  (async () => {
    if (await restoreIfCleared()) return;
    syncBar();
    backupNow();
    document.dispatchEvent(new Event('littledays:native-ready'));
    setTimeout(() => quiet(Splash?.hide?.({ fadeOutDuration: 200 })), 50);
  })();
})();
