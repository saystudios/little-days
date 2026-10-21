/* Little Days Meal Planner: a weekly plan built around practice and
   tournament days, with recipes and a grocery list. Family-synced.
   (Stored under the old Sports & Meals key so saved meals, recipes and lists
   carry over; older sports entries are kept untouched but no longer shown.) */
(() => {
  'use strict';
  const KEY = 'ld_sports_meals_v1';
  const defaults = () => ({events:[], meals:[], checklist:{}, dayTypes:{}, preferences:{cuisines:['Korean','Vietnamese','American'],allergies:[],servings:4}, groceryChecked:{}, customRecipes:[]});
  let data;
  const load=()=>{try{data={...defaults(),...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch{data=defaults();} if(!data.dayTypes||typeof data.dayTypes!=='object')data.dayTypes={};};
  load();
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(data));}catch{alert('Could not save on this device. Free up space and try again.');}window.littleDaysSportsSync?.queue();window.dispatchEvent(new Event('littledays:saved'));};
  window.addEventListener('little-days-sports-remote',()=>{load();if(active)render();});
  window.addEventListener('little-days-sports-conflict',()=>alert('Another parent updated the meal plan at the same time. The family version was reloaded. Please check your changes.'));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id=()=>String(Date.now())+Math.random().toString(36).slice(2,7);

  /* ---------- Entry points ---------- */
  const panel=document.createElement('section');
  panel.id='sportsMealsView'; panel.className='hidden'; panel.setAttribute('aria-label','Meal planner');
  document.querySelector('#main')?.append(panel);
  const nav=document.querySelector('.rail');
  const railButton=document.createElement('button');
  railButton.type='button'; railButton.className='tab sports-meals-entry'; railButton.innerHTML='<span aria-hidden="true">🍽️</span><span>Meal Planner</span>';
  nav?.insertBefore(railButton,nav.querySelector('.add-btn'));
  const barButton=document.querySelector('.tabbar [data-meals-tab]');
  let active=false;
  function open(){
    active=true;
    document.querySelectorAll('[data-page]').forEach(el=>el.classList.add('hidden'));
    panel.classList.remove('hidden');
    document.querySelectorAll('.tab[data-view]').forEach(b=>{b.classList.remove('active');b.removeAttribute('aria-current');});
    railButton.classList.add('active'); railButton.setAttribute('aria-current','page'); barButton?.setAttribute('aria-current','page');
    render(); window.scrollTo(0,0);
  }
  function close(){active=false;panel.classList.add('hidden');railButton.classList.remove('active');railButton.removeAttribute('aria-current');barButton?.removeAttribute('aria-current');}
  window.littleDaysSportsMeals={open};
  railButton.addEventListener('click',open);
  barButton?.addEventListener('click',open);
  document.addEventListener('click',e=>{if(active && e.target.closest('[data-view]'))close();},true);

  /* ---------- Days and meal slots ---------- */
  const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const todayName=()=>days[(new Date().getDay()+6)%7];
  const DAY_TYPES=[['rest','😌 Rest'],['practice','🏃 Practice'],['tournament','🏆 Tournament']];
  const TIPS={
    practice:'Fuel up with an easy snack 1–2 hours before practice, then refuel with protein and carbs afterward. Bring water.',
    tournament:'Light, familiar breakfast 2–3 hours before. Pack easy snacks and plenty of water for between matches.'
  };
  const BEFORE='Fuel before', AFTER='Recover after', BAG='Tournament bag';
  const slotsFor=type=>type==='tournament'?['Breakfast',BEFORE,BAG,'Lunch',AFTER,'Dinner']
    :type==='practice'?['Breakfast','Lunch',BEFORE,AFTER,'Dinner']:['Breakfast','Lunch','Snack','Dinner'];
  const SLOT_ICON={Breakfast:'🍳',Lunch:'🥪',Dinner:'🍲',Snack:'🍎',[BEFORE]:'⚡',[AFTER]:'💪',[BAG]:'🎒'};
  const ALL_TYPES=['Breakfast','Lunch','Dinner','Snack',BEFORE,AFTER,BAG];

  /* ---------- Recipes ---------- */
  const recipes=[
    {name:'Bibimbap',cuisine:'Korean',type:'Dinner',ingredients:['rice','carrots','spinach','eggs','beef','sesame oil','soy sauce'],allergens:['Egg','Soy','Sesame']},
    {name:'Bulgogi rice bowls',cuisine:'Korean',type:'Dinner',ingredients:['beef','rice','onion','garlic','soy sauce','sesame oil'],allergens:['Soy','Sesame']},
    {name:'Kimchi fried rice',cuisine:'Korean',type:'Lunch',ingredients:['rice','kimchi','eggs','scallions','sesame oil'],allergens:['Egg','Sesame']},
    {name:'Kimbap',cuisine:'Korean',type:'Lunch',ingredients:['rice','seaweed sheets','carrots','spinach','eggs','sesame oil'],allergens:['Egg','Sesame']},
    {name:'Doenjang vegetable stew',cuisine:'Korean',type:'Dinner',ingredients:['doenjang soybean paste','tofu','zucchini','onion','rice'],allergens:['Soy']},
    {name:'Rice balls (jumeokbap)',cuisine:'Korean',type:BEFORE,ingredients:['rice','seaweed sheets','sesame oil'],allergens:['Sesame']},
    {name:'Egg rice bowl (gyeran bap)',cuisine:'Korean',type:AFTER,ingredients:['rice','eggs','soy sauce','sesame oil'],allergens:['Egg','Soy','Sesame']},
    {name:'Mini kimbap rolls',cuisine:'Korean',type:BAG,ingredients:['rice','seaweed sheets','carrots','cucumber','sesame oil'],allergens:['Sesame']},
    {name:'Pho ga',cuisine:'Vietnamese',type:'Dinner',ingredients:['chicken','rice noodles','onion','ginger','cilantro','bean sprouts','lime'],allergens:[]},
    {name:'Banh mi',cuisine:'Vietnamese',type:'Lunch',ingredients:['baguette','chicken','cucumber','carrots','cilantro','mayonnaise'],allergens:['Wheat','Egg']},
    {name:'Fresh spring rolls',cuisine:'Vietnamese',type:'Lunch',ingredients:['rice paper','shrimp','lettuce','rice noodles','mint','cucumber'],allergens:['Shellfish']},
    {name:'Bun thit nuong',cuisine:'Vietnamese',type:'Dinner',ingredients:['pork','rice noodles','lettuce','cucumber','carrots','fish sauce'],allergens:['Fish']},
    {name:'Vietnamese chicken rice',cuisine:'Vietnamese',type:'Dinner',ingredients:['chicken','rice','cucumber','ginger','scallions'],allergens:[]},
    {name:'Sticky rice (xoi)',cuisine:'Vietnamese',type:BEFORE,ingredients:['sticky rice','mung beans'],allergens:[]},
    {name:'Chicken rice soup (chao ga)',cuisine:'Vietnamese',type:AFTER,ingredients:['rice','chicken','ginger','scallions'],allergens:[]},
    {name:'Steamed buns (banh bao)',cuisine:'Vietnamese',type:BAG,ingredients:['steamed buns'],allergens:['Wheat']},
    {name:'Oatmeal and berries',cuisine:'American',type:'Breakfast',ingredients:['oats','berries','milk'],allergens:['Milk']},
    {name:'Yogurt fruit bowl',cuisine:'American',type:'Breakfast',ingredients:['yogurt','bananas','berries'],allergens:['Milk']},
    {name:'Eggs and toast',cuisine:'American',type:'Breakfast',ingredients:['eggs','bread','oranges'],allergens:['Egg','Wheat']},
    {name:'Salmon and broccoli',cuisine:'American',type:'Dinner',ingredients:['salmon','broccoli','rice','olive oil'],allergens:['Fish']},
    {name:'Turkey wraps',cuisine:'American',type:'Lunch',ingredients:['tortillas','turkey','lettuce','tomatoes'],allergens:['Wheat']},
    {name:'Chicken stir-fry',cuisine:'American',type:'Dinner',ingredients:['chicken','rice','broccoli','carrots','olive oil'],allergens:[]},
    {name:'Banana and pretzels',cuisine:'American',type:'Snack',ingredients:['bananas','pretzels'],allergens:['Wheat']},
    {name:'Apples and sunflower butter',cuisine:'American',type:'Snack',ingredients:['apples','sunflower butter'],allergens:[]},
    {name:'Toast with honey and banana',cuisine:'American',type:BEFORE,ingredients:['bread','honey','bananas'],allergens:['Wheat']},
    {name:'Banana oatmeal',cuisine:'American',type:BEFORE,ingredients:['oats','bananas','milk'],allergens:['Milk']},
    {name:'Chocolate milk and fruit',cuisine:'American',type:AFTER,ingredients:['chocolate milk','oranges'],allergens:['Milk']},
    {name:'Turkey and cheese roll-ups',cuisine:'American',type:AFTER,ingredients:['tortillas','turkey','cheese'],allergens:['Wheat','Milk']},
    {name:'Orange slices and pretzels',cuisine:'American',type:BAG,ingredients:['oranges','pretzels'],allergens:['Wheat']},
    {name:'String cheese and crackers',cuisine:'American',type:BAG,ingredients:['string cheese','crackers'],allergens:['Milk','Wheat']},
    {name:'Nut-free trail mix',cuisine:'American',type:BAG,ingredients:['sunflower seeds','raisins','cereal'],allergens:[]},
    {name:'Water and electrolyte drinks',cuisine:'American',type:BAG,ingredients:['water bottles','electrolyte drinks'],allergens:[]}
  ];
  const allergenNames=['Milk','Egg','Wheat','Soy','Sesame','Fish','Shellfish','Peanut','Tree nut'];
  const pref=()=>data.preferences||(data.preferences={cuisines:['Korean','Vietnamese','American'],allergies:[],servings:4});
  const allRecipes=()=>[...recipes,...(data.customRecipes||[])];
  const eligible=()=>allRecipes().filter(r=>pref().cuisines.includes(r.cuisine)&&!(r.allergens||[]).some(a=>pref().allergies.includes(a)));
  const recipeFor=name=>allRecipes().find(r=>r.name===name);
  /* Snack ideas work for the bag, and before/after fit snack slots. */
  const fits=(r,slot)=>r.type===slot||(slot===BAG&&r.type==='Snack')||(slot==='Snack'&&(r.type===BEFORE||r.type===BAG));
  const choicesFor=slot=>eligible().filter(r=>fits(r,slot));
  const typeOf=day=>data.dayTypes[day]||'rest';
  const mealsOn=(day,slot)=>data.meals.filter(m=>m.day===day&&m.type===slot);

  /* ---------- Grocery list ---------- */
  const grocery=()=>{
    const items=new Map();
    for(const meal of data.meals){const recipe=recipeFor(meal.name);if(!recipe)continue;
      for(const ingredient of recipe.ingredients)items.set(ingredient,(items.get(ingredient)||0)+1);
    }
    return [...items].sort((a,b)=>a[0].localeCompare(b[0]));
  };

  /* ---------- Render ---------- */
  function render(){
    const t=todayName();
    const ordered=[...days.slice(days.indexOf(t)),...days.slice(0,days.indexOf(t))];
    panel.innerHTML=`<header class="page-head"><div><h1>Meal Planner</h1><p class="sub">Tag practice and tournament days, then plan meals that keep everyone fueled.</p></div></header>
      <div class="sm-actions"><button type="button" class="btn primary" id="smSmart">✨ Fill empty meals</button><button type="button" class="btn" id="smClearMeals">Clear week</button></div>
      <div class="mp-week">${ordered.map(day=>dayHTML(day,day===t)).join('')}</div>
      ${groceryHTML()}
      <details class="sm-card mp-more"><summary>📖 Recipes</summary>${recipeHTML()}</details>
      <details class="sm-card mp-more"><summary>✍️ Add your own recipe — free</summary>${customHTML()}</details>
      <details class="sm-card mp-more"><summary>🌏 Cuisines &amp; allergies</summary>${prefsHTML()}</details>
      <p class="sm-note">Meal plans, recipes and grocery lists sync with your family when signed in.</p>`;
    wire();
  }
  function dayHTML(day,isToday){
    const type=typeOf(day);
    return `<div class="sm-card mp-day mp-${type}"><div class="mp-day-head"><h2>${day}${isToday?' <span class="mp-today">Today</span>':''}</h2></div>
      <div class="mp-types" role="group" aria-label="${day} is a">${DAY_TYPES.map(([k,l])=>`<button type="button" data-day-type="${k}" data-day="${day}" class="${type===k?'chosen':''}" aria-pressed="${type===k}">${l}</button>`).join('')}</div>
      ${TIPS[type]?`<p class="mp-tip">${TIPS[type]}</p>`:''}
      ${slotsFor(type).map(slot=>slotHTML(day,slot)).join('')}
      ${extraHTML(day,type)}</div>`;
  }
  function slotHTML(day,slot){
    const planned=mealsOn(day,slot);
    return `<div class="mp-slot"><span class="mp-slot-name">${SLOT_ICON[slot]||'🍽️'} ${esc(slot)}</span><div class="mp-slot-meals">
      ${planned.map(m=>`<span class="mp-meal">${esc(m.name)}<button type="button" data-delete-meal="${esc(m.id)}" aria-label="Remove ${esc(m.name)}">✕</button></span>`).join('')}
      ${planned.length?'':`<select class="mp-pick" data-day="${day}" data-slot="${esc(slot)}" aria-label="Add ${esc(slot)} on ${day}"><option value="">+ Add</option>${choicesFor(slot).map(r=>`<option value="${esc(r.name)}">${esc(r.name)}</option>`).join('')}<option value="__own">✏️ Type my own…</option></select>`}
    </div></div>`;
  }
  /* Meals saved under a slot that isn't shown for today's day type (e.g. a
     Snack after switching to Tournament) stay visible so nothing disappears. */
  function extraHTML(day,type){
    const shown=slotsFor(type), extra=data.meals.filter(m=>m.day===day&&!shown.includes(m.type));
    return extra.length?`<div class="mp-slot"><span class="mp-slot-name">🍽️ Also planned</span><div class="mp-slot-meals">${extra.map(m=>`<span class="mp-meal">${esc(m.name)} <small>${esc(m.type)}</small><button type="button" data-delete-meal="${esc(m.id)}" aria-label="Remove ${esc(m.name)}">✕</button></span>`).join('')}</div></div>`:'';
  }
  function groceryHTML(){
    const items=grocery(), left=items.filter(([i])=>!data.groceryChecked?.[i]).length;
    return `<div class="sm-card"><h2>🛒 Grocery list${items.length?` <small class="mp-count">${left} to buy</small>`:''}</h2>
    ${items.length?items.map(([item,count])=>`<label class="sm-check"><input type="checkbox" data-grocery="${esc(item)}" ${data.groceryChecked?.[item]?'checked':''}><span>${esc(item)}${count>1?` <small>· ${count} meals</small>`:''}</span></label>`).join(''):'<p class="sub">Plan a few meals and their ingredients show up here.</p>'}
    ${items.length?'<div class="sm-actions"><button type="button" class="btn" id="smCopyGroceries">Copy list</button><button type="button" class="btn" id="smUncheck">Uncheck all</button></div>':''}
    <p class="sub">Counts show how many meals use an item, not amounts to buy. Always check labels for allergens.</p></div>`;
  }
  function recipeHTML(){
    const list=eligible();
    return `<div class="sm-recipes">${list.map(r=>`<div class="sm-recipe"><strong>${esc(r.name)}</strong><small>${esc(r.cuisine)} · ${esc(r.type)}</small><p>${esc(r.ingredients.join(', '))}</p>${r.instructions?`<p class="mp-steps">${esc(r.instructions)}</p>`:''}
      <select class="mp-recipe-day" data-recipe-add="${esc(r.name)}" aria-label="Add ${esc(r.name)} to a day"><option value="">+ Add to a day</option>${days.map(d=>`<option>${d}</option>`).join('')}</select></div>`).join('')||'<p class="sub">No matching recipes. Check Cuisines &amp; allergies.</p>'}</div>`;
  }
  function customHTML(){
    return `<form id="smCustomRecipe" class="sm-form"><label>Name<input name="name" maxlength="100" required></label>
      <div class="sm-row"><label>Cuisine<select name="cuisine"><option>Korean</option><option>Vietnamese</option><option>American</option></select></label>
      <label>Best for<select name="type">${ALL_TYPES.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label></div>
      <label>Ingredients, one per line<textarea name="ingredients" rows="4" required></textarea></label>
      <label>How to make it<textarea name="instructions" rows="4" required></textarea></label>
      <button class="btn primary" type="submit">Save recipe</button></form>
      <h3>📷 Recipe scanner</h3><p class="sub">Coming later as a premium feature. Nothing is charged.</p>`;
  }
  function prefsHTML(){
    return `<h3>Cuisines</h3>${['Korean','Vietnamese','American'].map(c=>`<label class="sm-check"><input type="checkbox" data-cuisine="${c}" ${pref().cuisines.includes(c)?'checked':''}>${c}</label>`).join('')}
      <h3>Allergies / avoid</h3>${allergenNames.map(a=>`<label class="sm-check"><input type="checkbox" data-allergen="${a}" ${pref().allergies.includes(a)?'checked':''}>${a}</label>`).join('')}
      <p class="sub">Filters are a guide only. Always check labels, sauces and cross-contact.</p>`;
  }

  /* ---------- Actions ---------- */
  function addMeal(day,slot,name){if(!name)return;data.meals.push({id:id(),day,type:slot,name:name.slice(0,100)});save();render();}
  function wire(){
    const q=s=>panel.querySelector(s), qa=s=>panel.querySelectorAll(s);
    // keep open <details> sections open across re-renders
    qa('details.mp-more').forEach((d,i)=>{if(openSections.has(i))d.open=true;d.ontoggle=()=>d.open?openSections.add(i):openSections.delete(i);});
    qa('[data-day-type]').forEach(b=>b.onclick=()=>{data.dayTypes[b.dataset.day]=b.dataset.dayType;save();render();});
    qa('.mp-pick').forEach(s=>s.onchange=()=>{
      let name=s.value; if(!name)return;
      if(name==='__own'){name=(prompt(`${s.dataset.slot} on ${s.dataset.day}:`)||'').trim();if(!name){s.value='';return;}}
      addMeal(s.dataset.day,s.dataset.slot,name);
    });
    qa('[data-recipe-add]').forEach(s=>s.onchange=()=>{const r=recipeFor(s.dataset.recipeAdd);if(!r||!s.value)return;addMeal(s.value,r.type,r.name);});
    qa('[data-delete-meal]').forEach(b=>b.onclick=()=>{data.meals=data.meals.filter(x=>x.id!==b.dataset.deleteMeal);save();render();});
    q('#smSmart').onclick=smartPlan;
    q('#smClearMeals').onclick=()=>{if(confirm('Clear all meals for the week? Day tags and recipes stay.')){data.meals=[];save();render();}};
    q('#smCopyGroceries')?.addEventListener('click',()=>{
      const list=grocery().filter(([i])=>!data.groceryChecked?.[i]).map(([name])=>'- '+name).join('\n');
      if(navigator.clipboard?.writeText)navigator.clipboard.writeText(list).then(()=>alert('Grocery list copied')).catch(()=>prompt('Copy grocery list:',list));
      else prompt('Copy grocery list:',list);
    });
    q('#smUncheck')?.addEventListener('click',()=>{data.groceryChecked={};save();render();});
    qa('[data-grocery]').forEach(b=>b.onchange=()=>{data.groceryChecked=data.groceryChecked||{};data.groceryChecked[b.dataset.grocery]=b.checked;save();render();});
    qa('[data-cuisine]').forEach(b=>b.onchange=()=>{const p=pref();p.cuisines=b.checked?[...new Set([...p.cuisines,b.dataset.cuisine])]:p.cuisines.filter(x=>x!==b.dataset.cuisine);save();render();});
    qa('[data-allergen]').forEach(b=>b.onchange=()=>{const p=pref();p.allergies=b.checked?[...new Set([...p.allergies,b.dataset.allergen])]:p.allergies.filter(x=>x!==b.dataset.allergen);save();render();});
    q('#smCustomRecipe')?.addEventListener('submit',e=>{
      e.preventDefault();
      const f=new FormData(e.currentTarget),name=String(f.get('name')||'').trim();
      if(allRecipes().some(r=>r.name.toLowerCase()===name.toLowerCase())){alert('A recipe with that name already exists.');return;}
      const ingredients=String(f.get('ingredients')||'').split(/\n|,/).map(x=>x.trim()).filter(Boolean);
      const instructions=String(f.get('instructions')||'').trim();
      if(!name||!ingredients.length||!instructions)return;
      data.customRecipes=data.customRecipes||[];
      data.customRecipes.push({name,cuisine:String(f.get('cuisine')),type:String(f.get('type')),ingredients,instructions,servings:4,allergens:[]});
      save();render();alert('Recipe saved. Find it under Recipes or in the + Add menus.');
    });
  }
  const openSections=new Set();
  function smartPlan(){
    if(!eligible().length){alert('No recipes match your filters. Check Cuisines & allergies.');return;}
    if(!confirm('Fill empty meals for the week? Meals you already planned stay.'))return;
    let n=data.meals.length;
    for(const day of days)for(const slot of slotsFor(typeOf(day))){
      if(mealsOn(day,slot).length)continue;
      const choices=choicesFor(slot); if(!choices.length)continue;
      data.meals.push({id:id(),day,type:slot,name:choices[(days.indexOf(day)+n++)%choices.length].name});
    }
    save();render();
  }
})();
