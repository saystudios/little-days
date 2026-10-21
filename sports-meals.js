/* Little Days Sports & Meals: family-synced planning, recipes and grocery lists. */
(() => {
  'use strict';
  const KEY = 'ld_sports_meals_v1';
  const defaults = () => ({events:[], meals:[], checklist:{}, preferences:{cuisines:['Korean','Vietnamese','American'],allergies:[],servings:4}, groceryChecked:{},customRecipes:[]});
  let data;
  try { data = {...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}')}; } catch { data=defaults(); }
  const save=()=>{localStorage.setItem(KEY,JSON.stringify(data));window.littleDaysSportsSync?.queue();};
  window.addEventListener('little-days-sports-remote',()=>{try{data={...defaults(),...JSON.parse(localStorage.getItem(KEY)||'{}')};if(active)render();}catch{}});
  window.addEventListener('little-days-sports-conflict',()=>alert('Another parent updated Sports & Meals at the same time. The family version was reloaded. Please check your changes.'));
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
    <p class="sm-note">Meals, preferences and lists are saved locally and sync with your family when signed in.</p>
    ${mode==='sports'?sportsHTML():mealsHTML()}`;
    panel.querySelectorAll('[data-sm-tab]').forEach(b=>b.onclick=()=>{mode=b.dataset.smTab;render();});
    panel.querySelector('#smEventForm')?.addEventListener('submit',addEvent);
    panel.querySelector('#smMealForm')?.addEventListener('submit',addMeal);
    panel.querySelector('#smSmart')?.addEventListener('click',smartPlan);
    panel.querySelector('#smCustomRecipe')?.addEventListener('submit',e=>{
      e.preventDefault();
      const f=new FormData(e.currentTarget),name=String(f.get('name')||'').trim();
      if([...recipes,...(data.customRecipes||[])].some(r=>r.name.toLowerCase()===name.toLowerCase())){alert('Recipe name already exists.');return;}
      const ingredients=String(f.get('ingredients')||'').split(/\n|,/).map(x=>x.trim()).filter(Boolean);
      const instructions=String(f.get('instructions')||'').trim();
      if(!name||!ingredients.length||!instructions)return;
      data.customRecipes=data.customRecipes||[];
      data.customRecipes.push({name,cuisine:String(f.get('cuisine')),type:String(f.get('type')),ingredients,instructions,servings:Number(f.get('servings'))||4,allergens:[]});
      save();render();
    });
    panel.querySelector('#smPremiumScan')?.addEventListener('click',()=>alert('Premium scanning is not available yet. No payment has been charged.'));

    panel.querySelector('#smClearMeals')?.addEventListener('click',()=>{if(confirm('Clear all planned meals?')){data.meals=[];save();render();}});
    panel.querySelector('#smCopyGroceries')?.addEventListener('click',()=>{
      const list=grocery().map(([name,count])=>'- '+name+(count>1?' ('+count+' meals)':'')).join('\\n');
      if(navigator.clipboard?.writeText)navigator.clipboard.writeText(list).then(()=>alert('Grocery list copied')).catch(()=>prompt('Copy grocery list:',list));
      else prompt('Copy grocery list:',list);
    });
    panel.querySelectorAll('[data-grocery]').forEach(b=>b.onchange=()=>{data.groceryChecked=data.groceryChecked||{};data.groceryChecked[b.dataset.grocery]=b.checked;save();});
    panel.querySelectorAll('[data-cuisine]').forEach(b=>b.onchange=()=>{const p=pref();p.cuisines=b.checked?[...new Set([...p.cuisines,b.dataset.cuisine])]:p.cuisines.filter(x=>x!==b.dataset.cuisine);save();render();});
    panel.querySelectorAll('[data-allergen]').forEach(b=>b.onchange=()=>{const p=pref();p.allergies=b.checked?[...new Set([...p.allergies,b.dataset.allergen])]:p.allergies.filter(x=>x!==b.dataset.allergen);save();render();});
    panel.querySelectorAll('[data-recipe-add]').forEach(b=>b.onclick=()=>{
      const recipe=recipeFor(b.dataset.recipeAdd);
      const day=prompt('Add to which day? (Monday–Sunday)','Monday');
      if(!day)return;
      const normalized=days.find(d=>d.toLowerCase()===day.trim().toLowerCase());
      if(!normalized){alert('Please enter a weekday, such as Monday.');return;}
      data.meals.push({id:id(),day:normalized,type:recipe.type,name:recipe.name});save();render();
    });
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
  const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const recipes=[
    {name:'Bibimbap',cuisine:'Korean',type:'Dinner',ingredients:['rice','carrots','spinach','eggs','beef','sesame oil','soy sauce'],allergens:['Egg','Soy','Sesame']},
    {name:'Bulgogi rice bowls',cuisine:'Korean',type:'Dinner',ingredients:['beef','rice','onion','garlic','soy sauce','sesame oil'],allergens:['Soy','Sesame']},
    {name:'Kimchi fried rice',cuisine:'Korean',type:'Lunch',ingredients:['rice','kimchi','eggs','scallions','sesame oil'],allergens:['Egg','Sesame']},
    {name:'Kimbap',cuisine:'Korean',type:'Lunch',ingredients:['rice','seaweed sheets','carrots','spinach','eggs','sesame oil'],allergens:['Egg','Sesame']},
    {name:'Doenjang vegetable stew',cuisine:'Korean',type:'Dinner',ingredients:['doenjang soybean paste','tofu','zucchini','onion','rice'],allergens:['Soy']},
    {name:'Pho ga',cuisine:'Vietnamese',type:'Dinner',ingredients:['chicken','rice noodles','onion','ginger','cilantro','bean sprouts','lime'],allergens:[]},
    {name:'Banh mi',cuisine:'Vietnamese',type:'Lunch',ingredients:['baguette','chicken','cucumber','carrots','cilantro','mayonnaise'],allergens:['Wheat','Egg']},
    {name:'Fresh spring rolls',cuisine:'Vietnamese',type:'Lunch',ingredients:['rice paper','shrimp','lettuce','rice noodles','mint','cucumber'],allergens:['Shellfish']},
    {name:'Bun thit nuong',cuisine:'Vietnamese',type:'Dinner',ingredients:['pork','rice noodles','lettuce','cucumber','carrots','fish sauce'],allergens:['Fish']},
    {name:'Vietnamese chicken rice',cuisine:'Vietnamese',type:'Dinner',ingredients:['chicken','rice','cucumber','ginger','scallions'],allergens:[]},
    {name:'Oatmeal and berries',cuisine:'American',type:'Breakfast',ingredients:['oats','berries','milk'],allergens:['Milk']},
    {name:'Yogurt fruit bowl',cuisine:'American',type:'Breakfast',ingredients:['yogurt','banana','berries'],allergens:['Milk']},
    {name:'Eggs and toast',cuisine:'American',type:'Breakfast',ingredients:['eggs','bread','oranges'],allergens:['Egg','Wheat']},
    {name:'Salmon and broccoli',cuisine:'American',type:'Dinner',ingredients:['salmon','broccoli','rice','olive oil'],allergens:['Fish']},
    {name:'Turkey wraps',cuisine:'American',type:'Lunch',ingredients:['tortillas','turkey','lettuce','tomatoes'],allergens:['Wheat']},
    {name:'Banana and pretzels',cuisine:'American',type:'Snack',ingredients:['bananas','pretzels'],allergens:['Wheat']},
    {name:'Apples and sunflower butter',cuisine:'American',type:'Snack',ingredients:['apples','sunflower butter'],allergens:[]},
    {name:'Chicken stir-fry',cuisine:'American',type:'Dinner',ingredients:['chicken','rice','broccoli','carrots','olive oil'],allergens:[]}
  ];
  const allergenNames=['Milk','Egg','Wheat','Soy','Sesame','Fish','Shellfish','Peanut','Tree nut'];
  const pref=()=>data.preferences||(data.preferences={cuisines:['Korean','Vietnamese','American'],allergies:[],servings:4});
  const eligible=()=>[...recipes,...(data.customRecipes||[])].filter(r=>pref().cuisines.includes(r.cuisine)&&!r.allergens.some(a=>pref().allergies.includes(a)));
  const recipeFor=name=>[...recipes,...(data.customRecipes||[])].find(r=>r.name===name);
  const grocery=()=>{
    const items=new Map();
    for(const meal of data.meals){const recipe=recipeFor(meal.name);if(!recipe)continue;
      for(const ingredient of recipe.ingredients)items.set(ingredient,(items.get(ingredient)||0)+1);
    }
    return [...items].sort((a,b)=>a[0].localeCompare(b[0]));
  };
  function smartPlan(){
    const pool=eligible();
    if(!pool.length){alert('No recipes match these filters. Choose another cuisine or adjust allergies.');return;}
    if(!confirm('Fill empty meal slots with suggested meals? Existing meals will stay unchanged.'))return;
    for(const day of days)for(const type of ['Breakfast','Lunch','Dinner','Snack']){
      if(data.meals.some(m=>m.day===day&&m.type===type))continue;
      const choices=pool.filter(r=>r.type===type);
      if(!choices.length)continue;
      const chosen=choices[(days.indexOf(day)+data.meals.length)%choices.length];
      data.meals.push({id:id(),day,type,name:chosen.name});
    }
    save();render();
  }
  function groceryHTML(){
    const items=grocery();
    return `<div class="sm-card"><h2>🛒 Grocery list</h2><p class="sub">Ingredients for selected built-in recipes; counts show recipe uses, not purchase quantities. Check packages for allergens.</p>
    ${items.length?items.map(([item,count])=>`<label class="sm-check"><input type="checkbox" data-grocery="${esc(item)}" ${data.groceryChecked?.[item]?'checked':''}><span>${esc(item)} ${count>1?'· '+count+' meals':''}</span></label>`).join(''):'<p class="sub">Add a recipe to create your grocery list.</p>'}
    <button type="button" class="btn" id="smCopyGroceries">Copy grocery list</button></div>`;
  }
  function mealPreferencesHTML(){
    return `<div class="sm-card"><h2>🌏 Food preferences</h2><p class="sub">Select cuisines and ingredients to avoid.</p>
    <h3>Cuisines</h3>${['Korean','Vietnamese','American'].map(c=>`<label class="sm-check"><input type="checkbox" data-cuisine="${c}" ${pref().cuisines.includes(c)?'checked':''}>${c}</label>`).join('')}
    <h3>Allergies / avoid</h3>${allergenNames.map(a=>`<label class="sm-check"><input type="checkbox" data-allergen="${a}" ${pref().allergies.includes(a)?'checked':''}>${a}</label>`).join('')}
    <p class="sub">Recipe filters are informational only. Always verify labels, sauces, substitutions and cross-contact risks.</p></div>`;
  }
  function recipeHTML(){
    return `<div class="sm-card"><h2>📖 Korean, Vietnamese & family recipes</h2><div class="sm-recipes">${eligible().map(r=>`<div class="sm-recipe"><strong>${esc(r.name)}</strong><small>${esc(r.cuisine)} · ${esc(r.type)}</small><p>${esc(r.ingredients.join(', '))}</p><button type="button" data-recipe-add="${esc(r.name)}">Add to plan</button></div>`).join('')||'<p>No matching recipes. Update your preferences.</p>'}</div></div>`;
  }
  function mealsHTML(){
    return `<div class="sm-actions"><button type="button" class="btn primary" id="smSmart">✨ Smart fill empty days</button><button type="button" class="btn" id="smClearMeals">Clear meal plan</button></div>
    <div class="sm-grid"><div class="sm-card"><h2>Weekly meal plan</h2>
    <form id="smMealForm" class="sm-form"><label>Day<select name="day">${days.map(d=>`<option>${d}</option>`).join('')}</select></label>
    <label>Meal<select name="type"><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select></label>
    <label>Meal or recipe<input name="name" maxlength="100" placeholder="Pho ga or family recipe" required></label><button class="btn primary" type="submit">Add meal</button></form>
    ${days.map(day=>`<div class="sm-day"><h3>${day}</h3>${data.meals.filter(m=>m.day===day).map(m=>`<div class="sm-item"><div><strong>${esc(m.name)}</strong><small>${esc(m.type)}</small></div><button type="button" data-delete-meal="${esc(m.id)}" aria-label="Delete meal">✕</button></div>`).join('')||'<p class="sub">No meals planned</p>'}</div>`).join('')}</div>
    <div class="sm-card"><h2>✍️ Create your own recipe — Free</h2><form id="smCustomRecipe" class="sm-form"><label>Name<input name="name" maxlength="100" required></label><label>Cuisine<select name="cuisine"><option>Korean</option><option>Vietnamese</option><option>American</option></select></label><label>Meal type<select name="type"><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select></label><label>Servings<input name="servings" type="number" min="1" max="30" value="4"></label><label>Ingredients, one per line<textarea name="ingredients" rows="4" required></textarea></label><label>Cooking instructions<textarea name="instructions" rows="4" required></textarea></label><button class="btn primary" type="submit">Save recipe</button></form><h3>📷 Premium recipe scanner</h3><p class="sub">Planned pricing: $2.99/month or $19.99/year. Scanning requires a future in-app purchase and secure processing integration.</p><button type="button" id="smPremiumScan" class="btn">🔒 Premium scan — Coming soon</button></div>${mealPreferencesHTML()}${recipeHTML()}${groceryHTML()}</div>`;
  }
  function addEvent(e){e.preventDefault();const f=new FormData(e.currentTarget);data.events.push({id:id(),title:String(f.get('title')).trim(),athlete:String(f.get('athlete')).trim(),date:String(f.get('date')),sport:String(f.get('sport'))});save();render();}
  function addMeal(e){e.preventDefault();const f=new FormData(e.currentTarget);data.meals.push({id:id(),day:String(f.get('day')),type:String(f.get('type')),name:String(f.get('name')).trim()});save();render();}
})();
