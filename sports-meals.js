/* Little Days Sports & Meals add-on. Data is local to this device until family-sync integration is implemented. */
(() => {
  'use strict';
  const KEY = 'ld_sports_meals_v1';
  const defaults = () => ({events:[], meals:[], checklist:{}});
  let data;
  try { data = {...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}')}; } catch { data=defaults(); }
  const save=()=>localStorage.setItem(KEY,JSON.stringify(data));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id=()=>String(Date.now())+Math.random().toString(36).slice(2,7);
  const panel=document.createElement('section');
  panel.id='sportsMealsView'; panel.className='hidden'; panel.setAttribute('aria-label','Sports and meal planning');
  document.querySelector('#main')?.append(panel);
  const nav=document.querySelector('.rail');
  const sportsButton=document.createElement('button');
  sportsButton.type='button'; sportsButton.className='tab sports-meals-entry'; sportsButton.innerHTML='<span aria-hidden="true">🏆</span><span>Sports & Meals</span>';
  nav?.insertBefore(sportsButton,nav.querySelector('.add-btn'));
  const homeButton=document.createElement('button'); homeButton.type='button';homeButton.className='sports-meals-home';
  homeButton.innerHTML='🏆 Sports & Meals';
  document.querySelector('#todayView .page-head')?.after(homeButton);
  let active=false, mode='sports';
  function open(which='sports') {
    mode=which;active=true;
    document.querySelectorAll('[data-page]').forEach(el=>el.classList.add('hidden'));
    panel.classList.remove('hidden'); document.querySelectorAll('.tab[data-view]').forEach(b=>b.classList.remove('active'));
    sportsButton.classList.add('active');render();
  }
  function close(){active=false;panel.classList.add('hidden');sportsButton.classList.remove('active');}
  sportsButton.addEventListener('click',()=>open('sports'));
  homeButton.addEventListener('click',()=>open('sports'));
  document.addEventListener('click',e=>{if(active && e.target.closest('[data-view]'))close();},true);
  const gear=['Uniform / dobok','Belt','Sparring gear','Headgear','Mouthguard','Water bottle','Healthy snacks','Extra clothes','Towel'];
  function render(){
    panel.innerHTML=`<header class="page-head"><div><h1>Sports & Meals</h1><p class="sub">A little planning makes busy days easier.</p></div></header>
    <div class="sm-tabs"><button type="button" data-sm-tab="sports" class="${mode==='sports'?'chosen':''}">🏆 Sports planner</button><button type="button" data-sm-tab="meals" class="${mode==='meals'?'chosen':''}">🍽️ Meal planner</button></div>
    <p class="sm-note">Saved on this device. Family sharing for these new sections is not enabled yet.</p>
    ${mode==='sports'?sportsHTML():mealsHTML()}`;
    panel.querySelectorAll('[data-sm-tab]').forEach(b=>b.onclick=()=>{mode=b.dataset.smTab;render();});
    panel.querySelector('#smEventForm')?.addEventListener('submit',addEvent);
    panel.querySelector('#smMealForm')?.addEventListener('submit',addMeal);
    panel.querySelectorAll('[data-delete-event]').forEach(b=>b.onclick=()=>{data.events=data.events.filter(x=>x.id!==b.dataset.deleteEvent);save();render();});
    panel.querySelectorAll('[data-delete-meal]').forEach(b=>b.onclick=()=>{data.meals=data.meals.filter(x=>x.id!==b.dataset.deleteMeal);save();render();});
    panel.querySelectorAll('[data-gear]').forEach(b=>b.onchange=()=>{const key=b.dataset.gear;data.checklist[key]=b.checked;save();render();});
  }
  function sportsHTML(){
    const events=[...data.events].sort((a,b)=>a.date.localeCompare(b.date));
    return `<div class="sm-grid"><div class="sm-card"><h2>Upcoming activities</h2>
      <form id="smEventForm" class="sm-form"><label>Activity or tournament<input name="title" placeholder="Taekwondo tournament" maxlength="90" required></label><label>Child / athlete<input name="athlete" placeholder="Child's name" maxlength="60" required></label><label>Date<input name="date" type="date" required></label><label>Sport<select name="sport"><option>Taekwondo</option><option>Soccer</option><option>Dance</option><option>Swimming</option><option>Other</option></select></label><button class="btn primary" type="submit">Add activity</button></form>
      ${events.length?events.map(x=>`<div class="sm-item"><div><strong>${esc(x.title)}</strong><small>${esc(x.athlete)} · ${esc(x.sport)} · ${esc(x.date)}</small></div><button type="button" data-delete-event="${esc(x.id)}" aria-label="Delete ${esc(x.title)}">✕</button></div>`).join(''):'<p class="sub">No activities yet. Add your first practice or tournament.</p>'}</div>
      <div class="sm-card"><h2>🎒 Tournament packing checklist</h2><p class="sub">Tap items as you pack.</p>
      ${gear.map(g=>`<label class="sm-check"><input type="checkbox" data-gear="${esc(g)}" ${data.checklist[g]?'checked':''}><span>${esc(g)}</span></label>`).join('')}
      <p class="sm-progress">${gear.filter(g=>data.checklist[g]).length} of ${gear.length} packed</p></div></div>`;
  }
  function mealsHTML(){
    const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    return `<div class="sm-grid"><div class="sm-card"><h2>Weekly meal plan</h2><form id="smMealForm" class="sm-form"><label>Day<select name="day">${days.map(d=>`<option>${d}</option>`).join('')}</select></label><label>Meal<select name="type"><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select></label><label>What are you making?<input name="name" maxlength="100" placeholder="Chicken and rice bowl" required></label><button class="btn primary" type="submit">Add meal</button></form>
    ${days.map(day=>`<div class="sm-day"><h3>${day}</h3>${data.meals.filter(m=>m.day===day).map(m=>`<div class="sm-item"><div><strong>${esc(m.name)}</strong><small>${esc(m.type)}</small></div><button type="button" data-delete-meal="${esc(m.id)}" aria-label="Delete meal">✕</button></div>`).join('')||'<p class="sub">No meals planned</p>'}</div>`).join('')}</div>
    <div class="sm-card"><h2>🥗 Family meal ideas</h2><p>Breakfast: oatmeal, yogurt and fruit, eggs and toast.</p><p>Lunch: chicken wraps, rice bowls, bean and cheese quesadillas.</p><p>Dinner: salmon and rice, chicken noodle soup, tofu stir-fry.</p><p>Sports-day snacks: bananas, pretzels, applesauce, yogurt.</p><p class="sub">Check ingredients and allergies individually. These are general ideas, not individualized nutrition prescriptions.</p></div></div>`;
  }
  function addEvent(e){e.preventDefault();const f=new FormData(e.currentTarget);data.events.push({id:id(),title:String(f.get('title')).trim(),athlete:String(f.get('athlete')).trim(),date:String(f.get('date')),sport:String(f.get('sport'))});save();render();}
  function addMeal(e){e.preventDefault();const f=new FormData(e.currentTarget);data.meals.push({id:id(),day:String(f.get('day')),type:String(f.get('type')),name:String(f.get('name')).trim()});save();render();}
})();
