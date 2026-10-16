/* Optional on-device reminders while the site is open; not background push. */
(function(){
if(!('Notification' in window))return;
const bar=document.createElement('div');
bar.style='position:fixed;left:12px;bottom:calc(78px + env(safe-area-inset-bottom,0px));z-index:39;background:#fff;border:1px solid #f0e7e4;border-radius:12px;padding:9px;box-shadow:0 5px 20px #3332;font:12px system-ui;color:#29334a';
bar.innerHTML='<select id="ldReminderMinutes" aria-label="Remind before event" style="padding:7px;border:1px solid #eee;border-radius:8px"><option value="5">5 min</option><option value="10">10 min</option><option value="15">15 min</option><option value="30">30 min</option><option value="60">1 hour</option></select> <button id="ldReminders" style="border:0;background:#fff0f3;border-radius:8px;padding:7px 10px;cursor:pointer">🔔 Enable reminders</button><div id="ldReminderInfo" style="font-size:11px;margin-top:4px">Works only while the website is open</div>';document.body.append(bar);
const btn=bar.querySelector('#ldReminders'),info=bar.querySelector('#ldReminderInfo');
const selector=bar.querySelector('#ldReminderMinutes');selector.value=localStorage.getItem('ld_reminder_minutes')||'10';selector.onchange=()=>localStorage.setItem('ld_reminder_minutes',selector.value);const active=localStorage.getItem('ld_reminders')==='yes';
if(active&&Notification.permission==='granted')btn.textContent='🔔 Reminders enabled';
btn.addEventListener('click',async()=>{const p=await Notification.requestPermission();if(p==='granted'){localStorage.setItem('ld_reminders','yes');btn.textContent='🔔 Reminders enabled';info.textContent='Keep the site open for notifications'}else info.textContent='Notifications not permitted on this device'});
const alerted=new Set();
function check(){
if(localStorage.getItem('ld_reminders')!=='yes'||Notification.permission!=='granted'||typeof getEvents!=='function')return;
const now=new Date(),stamp=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
for(const e of getEvents(stamp(now),stamp(now))){
if(!e.time)continue;const when=new Date(e.on+'T'+e.time+':00');const mins=(when-now)/60000;
const key=e.id+'|'+e.on+'|'+e.time;if(mins>=0&&mins<=Number(selector.value)&&!alerted.has(key)){alerted.add(key);new Notification('Little Days: '+(e.title||'Upcoming activity'),{body:'Starts at '+e.time+(e.location?' · '+e.location:'')});}
}
}
setInterval(check,60000);check();
})();
