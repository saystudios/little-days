/* Little Days optional Supabase family sync. Needs cloud-config.js and the SQL
   in supabase/. Shown in Settings → Family sync; a small status pill sits
   under the page title. The planner always works offline without it. */
(async function () {
  'use strict';
  const cfg = window.LITTLE_DAYS_CLOUD;
  const core = window.LittleDaysCore;
  const STORE = 'littledays_v1';
  const SUPABASE_VERSION = '2.45.4';
  const isWeb = /^https?:$/.test(location.protocol);

  const mount = document.getElementById('cloudMount') || document.body.appendChild(document.createElement('div'));
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.setAttribute('aria-live', 'polite');
  mount.append(panel);
  const pills = [...document.querySelectorAll('#syncPill, [data-sync-pill]')];
  pills.forEach(p => { p.onclick = () => typeof setView === 'function' && setView('settings'); });

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = sel => panel.querySelector(sel);
  const show = html => { panel.innerHTML = '<h3>☁️ Family sync</h3>' + html + '<p class="cloud-msg" id="cloudMessage"></p>'; };
  const msg = (text, isError) => { const m = $('#cloudMessage'); if (m) { m.textContent = text || ''; m.classList.toggle('error', !!isError); } };
  const status = (text) => pills.forEach(p => { p.hidden = !text; p.textContent = text || ''; });
  const busyButton = async (btn, fn) => { btn.disabled = true; try { await fn(); } finally { btn.disabled = false; } };
  const friendly = e => {
    const m = e?.message || String(e);
    if (e?.code === 'PGRST202' || /Could not find the function/i.test(m))
      return 'This needs the latest database update. Ask the account owner to run the newest file in supabase/migrations.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No connection right now. Your changes are safe on this device and will sync when you are back online.';
    return m;
  };

  if (!cfg?.url || !cfg?.anonKey) {
    show('<p class="sub">Sync is not set up for this copy of Little Days. Your planner is saved on this device.</p>');
    return;
  }

  /* Supabase client: bundled copy first (works offline in the iPhone app),
     then a version-pinned CDN copy for the website. */
  async function loadSupabase() {
    if (window.supabase?.createClient) return window.supabase;
    await new Promise(resolve => {
      const s = document.createElement('script');
      s.src = './vendor/supabase.js';
      s.onload = resolve; s.onerror = resolve;
      document.head.append(s);
    });
    if (window.supabase?.createClient) return window.supabase;
    return import(`https://esm.sh/@supabase/supabase-js@${SUPABASE_VERSION}`);
  }
  let lib;
  try { lib = await loadSupabase(); }
  catch (e) { show('<p class="sub">Sync can\'t load right now. Your planner still works on this device.</p>'); status('Offline'); return; }

  const client = lib.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: isWeb } });
  let user = null, family = null, queueTimer = null, pollTimer = null, liveChannel = null;
  let loading = false, dirty = false, busy = false, lastVersion = null;

  const snapshot = () => { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; } };

  async function readCloud() {
    if (!family || dirty || busy) return;
    const { data: row, error } = await client.from('family_planners').select('content,updated_at').eq('family_id', family).single();
    if (error) throw error;
    if (dirty || busy) return;
    if (core.isPlanner(row.content)) {
      lastVersion = row.updated_at;
      loading = true;
      try { data = row.content; localStorage.setItem(STORE, JSON.stringify(data)); render(); }
      finally { loading = false; }
    }
  }

  async function upload() {
    if (!family || loading || busy) return;
    clearTimeout(queueTimer); queueTimer = null;
    const value = snapshot();
    if (!core.isPlanner(value)) return;
    busy = true; status('Saving…');
    try {
      // updated_at is overwritten by the server once the 2026-10-17 migration
      // runs; the client value keeps older databases working.
      let query = client.from('family_planners').update({ content: value, updated_at: new Date().toISOString() }).eq('family_id', family);
      if (lastVersion) query = query.eq('updated_at', lastVersion);
      const { data: rows, error } = await query.select('updated_at');
      if (error) throw error;
      if (!rows?.length) {
        dirty = true; status('⚠️ Needs review');
        msg('Another parent changed the planner at the same time. Export a backup in "Your planner data", then reload to see their version.', true);
        return;
      }
      lastVersion = rows[0].updated_at; dirty = false;
      status('☁️ Synced'); msg('All changes saved.');
    } catch (e) { status('⚠️ Not synced'); msg(friendly(e), true); }
    finally { busy = false; }
  }

  window.littleDaysSync = { queue() { if (!family || loading) return; dirty = true; status('Saving…'); clearTimeout(queueTimer); queueTimer = setTimeout(upload, 900); } };
  window.addEventListener('online', () => { if (family && dirty && !busy) upload(); });

  function stopSync() {
    clearInterval(pollTimer); pollTimer = null;
    clearTimeout(queueTimer); queueTimer = null;
    if (liveChannel) { client.removeChannel(liveChannel); liveChannel = null; }
    family = null; dirty = false; lastVersion = null;
  }

  /* Sign in with a 6-digit email code. Codes work inside the iPhone app,
     where email links would open the website instead. */
  function loginUI(email = '') {
    status('');
    show('<p class="sub">Share one planner between parents. Sign in with your email and we\'ll send you a code.</p>' +
      '<form class="cloud-form" id="emailForm"><label class="sr-only" for="cloudEmail">Parent email</label>' +
      '<input id="cloudEmail" type="email" autocomplete="email" inputmode="email" required placeholder="Parent email" value="' + esc(email) + '">' +
      '<button class="primary" type="submit">Send code</button></form>');
    $('#emailForm').onsubmit = ev => {
      ev.preventDefault();
      const btn = ev.target.querySelector('button');
      busyButton(btn, async () => {
        const address = $('#cloudEmail').value.trim();
        const options = isWeb ? { emailRedirectTo: location.origin + location.pathname } : {};
        const { error } = await client.auth.signInWithOtp({ email: address, options });
        if (error) return msg(friendly(error), true);
        codeUI(address);
      });
    };
  }

  function codeUI(email) {
    show('<p class="sub">We emailed a sign-in code to <b>' + esc(email) + '</b>. Enter it below' + (isWeb ? ', or tap the link in the email.' : '.') + '</p>' +
      '<form class="cloud-form" id="codeForm"><label class="sr-only" for="cloudCode">Sign-in code</label>' +
      '<input id="cloudCode" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" required placeholder="Code from email">' +
      '<button class="primary" type="submit">Sign in</button></form>' +
      '<div class="settings-row"><button class="ghost" type="button" id="cloudBack">Use a different email</button></div>');
    $('#cloudBack').onclick = () => loginUI(email);
    $('#codeForm').onsubmit = ev => {
      ev.preventDefault();
      busyButton(ev.target.querySelector('button'), async () => {
        const token = $('#cloudCode').value.replace(/\D/g, '');
        const { data: res, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
        if (error) return msg(/expired|invalid/i.test(error.message) ? 'That code is wrong or has expired. Request a new one.' : friendly(error), true);
        user = res.user; startup();
      });
    };
  }

  function chooseFamilyUI() {
    status('');
    show('<p class="sub">Signed in as <b>' + esc(user.email) + '</b>.</p>' +
      '<div class="settings-row"><button class="primary" id="cloudCreate" type="button">Start a family with this planner</button></div>' +
      '<p class="sub">Got an invite code from the other parent?</p>' +
      '<form class="cloud-form" id="joinForm"><label class="sr-only" for="cloudInvite">Invite code</label>' +
      '<input id="cloudInvite" autocomplete="off" autocapitalize="characters" spellcheck="false" required placeholder="Invite code">' +
      '<button class="ghost" type="submit">Join family</button></form>' +
      '<div class="settings-row"><button class="ghost" id="cloudLogout" type="button">Sign out</button></div>');
    $('#cloudCreate').onclick = ev => busyButton(ev.target, async () => {
      const { data: rows, error } = await client.rpc('create_family', { initial_data: snapshot() || { kids: [], events: [], tasks: [] } });
      if (error) return msg(friendly(error), true);
      family = rows[0].id; await activeUI();
    });
    $('#joinForm').onsubmit = ev => {
      ev.preventDefault();
      busyButton(ev.target.querySelector('button'), async () => {
        const local = snapshot();
        const hasLocal = local && (local.events.length || local.tasks.length);
        if (hasLocal && !confirm('Joining replaces the planner on this device with your family\'s shared planner. A copy of this device\'s planner will be kept as a backup. Continue?')) return;
        const { data: id, error } = await client.rpc('join_family', { code: $('#cloudInvite').value });
        if (error) return msg(/invalid invite/i.test(error.message) ? 'That code is wrong or has expired.' : friendly(error), true);
        if (!id) return msg('That code is wrong or has expired. Ask the other parent for a new one.', true);
        if (local) localStorage.setItem(STORE + '_before_join', JSON.stringify({ savedAt: new Date().toISOString(), planner: local }));
        family = id; await activeUI();
      });
    };
    $('#cloudLogout').onclick = signOut;
  }

  async function activeUI() {
    show('<p class="sub">Signed in as <b>' + esc(user.email) + '</b>. Changes sync to every parent in your family.</p>' +
      '<h4 style="margin:16px 0 4px">Invite another parent</h4>' +
      '<div class="invite-code" id="inviteCode">…</div><p class="note" id="inviteExpiry"></p>' +
      '<div class="settings-row"><button class="ghost" id="cloudCopy" type="button">Copy code</button><button class="ghost" id="cloudNewCode" type="button">Make a new code</button></div>' +
      '<p class="note">Share the code privately. Making a new code stops the old one from working.</p>' +
      '<div id="memberList"></div>' +
      '<div class="settings-row"><button class="ghost" id="cloudLogout" type="button">Sign out</button></div>' +
      '<div class="danger-zone"><div class="settings-row"><button class="danger" id="cloudLeave" type="button">Leave family</button><button class="danger" id="cloudDelete" type="button">Delete my account</button></div></div>');
    let code = '';
    const showCode = (c, expires) => {
      code = c || '';
      $('#inviteCode').textContent = code.replace(/(.{6})(?=.)/g, '$1 ');
      $('#inviteExpiry').textContent = expires ? 'Works until ' + new Date(expires).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) + '.' : '';
    };
    client.from('families').select('*').eq('id', family).single().then(({ data: f }) => f && showCode(f.invite_code, f.invite_expires_at));
    client.rpc('family_members_list', { fid: family }).then(({ data: rows, error }) => {
      if (error || !rows?.length) return;
      $('#memberList').innerHTML = '<h4 style="margin:16px 0 4px">Parents in this family</h4>' + rows.map(r =>
        '<div class="note" style="font-size:14px;color:var(--ink)">' + esc(r.email) + (r.is_me ? ' (you)' : '') + (r.role === 'owner' ? ' · owner' : '') + '</div>').join('');
    });
    $('#cloudCopy').onclick = () => navigator.clipboard?.writeText(code).then(() => msg('Code copied.'), () => msg('Copy failed — write the code down instead.', true));
    $('#cloudNewCode').onclick = ev => busyButton(ev.target, async () => {
      if (!confirm('Make a new invite code? The current code will stop working.')) return;
      const { data: rows, error } = await client.rpc('regenerate_invite', { fid: family });
      if (error) return msg(friendly(error), true);
      showCode(rows[0].invite_code, rows[0].invite_expires_at); msg('New code ready.');
    });
    $('#cloudLogout').onclick = signOut;
    $('#cloudLeave').onclick = ev => busyButton(ev.target, async () => {
      if (!confirm('Leave this family? The planner stays on this device, but it will stop syncing.')) return;
      const { error } = await client.rpc('leave_family', { fid: family });
      if (error) return msg(friendly(error), true);
      stopSync(); chooseFamilyUI(); msg('You left the family. Your planner is still on this device.');
    });
    $('#cloudDelete').onclick = ev => busyButton(ev.target, async () => {
      const typed = prompt('This permanently deletes your Little Days account and removes you from your family. If you are the only parent, the shared planner is deleted from the cloud too.\n\nType DELETE to confirm.');
      if (typed?.trim().toUpperCase() !== 'DELETE') return msg('Account not deleted.');
      const { error } = await client.rpc('delete_account');
      if (error) return msg(friendly(error), true);
      stopSync(); await client.auth.signOut(); user = null;
      loginUI(); msg('Your account has been deleted. The planner on this device was kept; use "Reset planner on this device" below to remove it too.');
    });

    try { dirty = false; await readCloud(); status('☁️ Synced'); msg(''); }
    catch (e) { status('⚠️ Not synced'); msg(friendly(e), true); }

    if (liveChannel) client.removeChannel(liveChannel);
    liveChannel = client.channel('family-' + family).on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'family_planners', filter: 'family_id=eq.' + family },
      async payload => {
        if (dirty || busy || queueTimer) return msg('Another parent changed the planner; it will refresh after your changes save.');
        if (payload.new?.updated_at === lastVersion) return;
        try { await readCloud(); status('☁️ Synced'); } catch (e) { msg(friendly(e), true); }
      }).subscribe();
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      if (dirty && !busy && !queueTimer) return upload();
      if (!queueTimer && !dirty && !busy) { try { await readCloud(); } catch { /* retried next tick */ } }
    }, 30000);
  }

  async function signOut() { stopSync(); await client.auth.signOut(); user = null; loginUI(); msg('Signed out. Your planner is still on this device.'); }

  async function startup() {
    const { data: { user: u } } = await client.auth.getUser();
    user = u;
    if (!user) return loginUI();
    const { data: rows, error } = await client.from('family_members').select('family_id').eq('user_id', user.id).limit(1);
    if (error) { show('<p class="sub">Sync isn\'t available right now.</p>'); msg(friendly(error), true); status('⚠️ Not synced'); return; }
    if (rows.length) { family = rows[0].family_id; return activeUI(); }
    chooseFamilyUI();
  }

  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user && !user) { user = session.user; setTimeout(startup, 0); }
  });
  startup().catch(e => { show('<p class="sub">Sync isn\'t available right now.</p>'); msg(friendly(e), true); });
})();
