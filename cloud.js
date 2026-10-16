/* Little Days optional Supabase cloud sync. Requires config.js and SQL setup. */
(async function(){
const cfg=window.LITTLE_DAYS_CLOUD;
const mount=document.createElement('section');
mount.id='cloudPanel';
mount.style='position:fixed;right:12px;bottom:calc(78px + env(safe-area-inset-bottom,0px));z-index:40;background:white;border:1px solid #f0e7e4;border-radius:16px;box-shadow:0 8px 30px #3332;padding:12px;max-width:310px;width:calc(100% - 24px);font:14px system-ui;color:#29334a';
document.body.append(mount);
const set=(h)=>{mount.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><strong>Little Days cloud</strong><button type="button" id="cloudToggle" aria-label="Minimize cloud panel" style="border:0;border-radius:9px;padding:8px;background:#fff0f3;cursor:pointer">−</button></div><div id="cloudBody" style="margin-top:8px">'+h+'</div>';mount.querySelector('#cloudToggle').onclick=()=>{let body=mount.querySelector('#cloudBody');const hide=body.style.display!=='none';body.style.display=hide?'none':'block';mount.querySelector('#cloudToggle').textContent=hide?'+':'−';mount.style.maxWidth=hide?'185px':'310px';}};
if(!cfg?.url||!cfg?.anonKey){set('<b>☁️ Cloud sync not configured</b><div style="font-size:12px;margin-top:5px">Your planner is stored on this device. Family accounts require cloud setup.</div>');return}
let mod;try{mod=await import('https://esm.sh/@supabase/supabase-js@2');}catch(e){set('Cloud login unavailable. Offline planner still works.');return}
const client=mod.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let user=null,family=null,queueTimer=null,pollTimer=null,loading=false,dirty=false,lastVersion=null,busy=false;
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[c]));
const msg=s=>{let m=mount.querySelector('#cloudMessage');if(m)m.textContent=s};
const unpack=x=>x&&Array.isArray(x.kids)&&Array.isArray(x.events)&&Array.isArray(x.tasks);
const snapshot=()=>JSON.parse(localStorage.getItem('littledays_v1')||'null');
async function readCloud(){if(!family||dirty||busy)return;const {data:row,error}=await client.from('family_planners').select('content,updated_at').eq('family_id',family).single();if(error)throw error;if(dirty||busy)return;if(unpack(row.content)){lastVersion=row.updated_at;loading=true;try{data=row.content;localStorage.setItem('littledays_v1',JSON.stringify(data));render()}finally{loading=false}}}
async function upload(){if(!family||loading||busy)return;clearTimeout(queueTimer);queueTimer=null;const value=snapshot();if(!unpack(value))return;busy=true;try{let query=client.from('family_planners').update({content:value,updated_at:new Date().toISOString()}).eq('family_id',family);if(lastVersion)query=query.eq('updated_at',lastVersion);const {data:rows,error}=await query.select('updated_at');if(error)throw error;if(!rows?.length){dirty=true;msg('⚠️ Another device updated the schedule. Export a backup before reloading, then refresh to review.');return}lastVersion=rows[0].updated_at;dirty=false;msg('☁️ Saved');}catch(e){msg('Sync error: '+e.message)}finally{busy=false}}
window.littleDaysSync={queue(){if(!family||loading)return;dirty=true;clearTimeout(queueTimer);queueTimer=setTimeout(upload,900)}};
function loginUI(){set('<b>☁️ Family cloud account</b><p style="font-size:12px">Sign in with an email link to sync across phones.</p><input id="cloudEmail" type="email" placeholder="Parent email" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px"><button id="cloudLogin" style="margin-top:8px;padding:9px">Email sign-in link</button><p id="cloudMessage" style="font-size:12px"></p>');mount.querySelector('#cloudLogin').onclick=async()=>{let email=mount.querySelector('#cloudEmail').value.trim();if(!email)return msg('Enter your email');const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});msg(error?error.message:'Check your email for a sign-in link.')};}
async function chooseFamily(){if(!user)return loginUI();set('<b>☁️ Family sharing</b><p style="font-size:12px">Create a shared family or join with an invite code.</p><button id="cloudCreate">Create family from this device</button><div style="display:flex;gap:6px;margin-top:8px"><input id="cloudCode" placeholder="Invite code" style="width:160px;padding:8px"><button id="cloudJoin">Join</button></div><button id="cloudLogout" style="margin-top:10px">Sign out</button><p id="cloudMessage" style="font-size:12px"></p>');
mount.querySelector('#cloudCreate').onclick=async()=>{let {data:rows,error}=await client.rpc('create_family',{initial_data:snapshot()});if(error)return msg(error.message);family=rows[0].id;await activeUI(rows[0].invite_code)};
mount.querySelector('#cloudJoin').onclick=async()=>{let code=mount.querySelector('#cloudCode').value;const {data:id,error}=await client.rpc('join_family',{code});if(error)return msg(error.message);family=id;await activeUI()};
mount.querySelector('#cloudLogout').onclick=async()=>{await client.auth.signOut();family=null;loginUI()};
}
async function activeUI(code){if(!code){let x=await client.from('families').select('invite_code').eq('id',family).single();code=x.data?.invite_code||''}
set('<b>☁️ Family sync enabled</b><p style="font-size:12px">Invite another parent using this code:</p><div style="font-weight:700;word-break:break-all" id="inviteCode">'+esc(code)+'</div><button id="cloudCopy" style="margin-top:7px">Copy code</button> <button id="cloudLogout">Sign out</button><p id="cloudMessage" style="font-size:12px">Syncing…</p>');
mount.querySelector('#cloudCopy').onclick=()=>navigator.clipboard.writeText(code).then(()=>msg('Copied'));
mount.querySelector('#cloudLogout').onclick=async()=>{await client.auth.signOut();family=null;clearInterval(pollTimer);loginUI()};
try{dirty=false;await readCloud();msg('☁️ Synced')}catch(e){msg(e.message)}
clearInterval(pollTimer);pollTimer=setInterval(async()=>{if(document.visibilityState==='visible'&&!queueTimer&&!dirty&&!busy){try{await readCloud()}catch(e){}}},30000)
}
async function startup(){const {data:{user:u}}=await client.auth.getUser();user=u;if(!user)return loginUI();const {data:rows,error}=await client.from('family_members').select('family_id').eq('user_id',user.id).limit(1);if(error)return set('Cloud setup error: '+esc(error.message));if(rows.length){family=rows[0].family_id;return activeUI()}chooseFamily()}
client.auth.onAuthStateChange((_event,session)=>{if(session?.user&&!user){user=session.user;setTimeout(startup,0)}});
startup();
})();
