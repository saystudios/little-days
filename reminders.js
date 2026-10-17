/* Optional on-device reminders while Little Days is open; not background push. */
(function(){
if(!('Notification' in window))return;
const core=window.LittleDaysCore;
const mount=document.getElementById('remindersMount');
const box=document.createElement('div');
box.className='panel';
box.innerHTML='<h3>🔔 Activity reminders</h3><p class="sub">A notification shortly before each timed activity, for every family member.</p><div class="settings-row"><label for="ldReminderMinutes" class="sr-only">Remind before activity</label><select id="ldReminderMinutes" class="ghost"><option value="5">5 min before</option><option value="10">10 min before</option><option value="15">15 min before</option><option value="30">30 min before</option><option value="60">1 hour before</option></select><button id="ldReminders" class="ghost" type="button">Enable reminders</button></div><p id="ldReminderInfo" class="note">Reminders only appear while Little Days is open on this device.</p>';
if(mount)mount.append(box);else return;
const btn=box.querySelector('#ldReminders'),info=box.querySelector('#ldReminderInfo'),selector=box.querySelector('#ldReminderMinutes');
selector.value=localStorage.getItem('ld_reminder_minutes')||'10';
selector.onchange=()=>localStorage.setItem('ld_reminder_minutes',selector.value);
const enabled=()=>localStorage.getItem('ld_reminders')==='yes'&&Notification.permission==='granted';
const label=()=>{btn.textContent=enabled()?'✓ Reminders on':'Enable reminders'};
label();
btn.addEventListener('click',async()=>{
 if(enabled()){localStorage.setItem('ld_reminders','no');label();return}
 const p=await Notification.requestPermission();
 if(p==='granted'){localStorage.setItem('ld_reminders','yes');info.textContent='Reminders are on. Keep Little Days open to receive them.'}
 else info.textContent='Notifications are blocked for this site. You can allow them in your browser settings.';
 label();
});
const alerted=new Set();
function check(){
 if(!enabled()||typeof getAllEvents!=='function'||!core)return;
 const now=new Date(),today=core.dateKey(now),tomorrow=core.dateKey(core.plusDays(now,1));
 for(const e of getAllEvents(today,tomorrow)){
  const when=core.startsAt(e.on,e.time);if(!when)continue;
  const mins=(when-now)/60000,key=e.id+'|'+e.on+'|'+e.time;
  if(mins>=0&&mins<=Number(selector.value)&&!alerted.has(key)){
   alerted.add(key);
   new Notification('Little Days: '+(e.title||'Upcoming activity'),{body:'Starts at '+e.time+(e.location?' · '+e.location:''),tag:key});
  }
 }
}
setInterval(check,60000);check();
})();
