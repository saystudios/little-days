/* Little Days Meal Plan: two weekly plans (Everyday meals and Sports meals),
   ready-to-cook recipes, favorites, filters and a grocery list. Family-synced.
   Stored under the old Sports & Meals key so saved recipes, preferences and
   lists carry over. Older weekday-based meals are copied into this week once. */
(() => {
  'use strict';
  const KEY = 'ld_sports_meals_v1';
  const defaults = () => ({events:[], meals:[], checklist:{}, dayTypes:{}, planMeals:null, favorites:[],
    preferences:{cuisines:['Korean','Vietnamese','American'],allergies:[],servings:4}, groceryChecked:{}, customRecipes:[]});
  let data;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id=()=>String(Date.now())+Math.random().toString(36).slice(2,7);
  const pad=n=>String(n).padStart(2,'0');
  const keyOf=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parse=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d);};
  const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
  const monday=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());return addDays(x,-((x.getDay()+6)%7));};
  const weekDates=off=>{const m=addDays(monday(new Date()),off*7);return Array.from({length:7},(_,i)=>keyOf(addDays(m,i)));};
  const WD=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], WEEKDAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  /* ---------- Plans and meal slots ---------- */
  const PLANS={regular:{label:'Everyday meals',icon:'🏡',slots:['Breakfast','Lunch','Dinner','Snacks']},
    sports:{label:'Sports meals',icon:'🏆',slots:['Breakfast','Fuel before','Lunch','Recover after','Dinner','Snacks']}};
  const SLOT_ICON={Breakfast:'☀️',Lunch:'🍴','Fuel before':'⚡','Recover after':'💪',Dinner:'🌙',Snacks:'🍎'};
  const SLOT_HINT={'Fuel before':'1–2 hrs before practice','Recover after':'after practice or games'};

  /* ---------- Recipes (ready to cook) ----------
     t: best meal · a: picture (emoji) · g: food groups p=protein c=carbs v=fruit/veg */
  const R=(n,k,c,t,a,g,i,al,s)=>({name:n,native:k,cuisine:c,type:t,art:a,groups:g,ingredients:i,allergens:al,steps:s});
  const BUILT_IN=[
    R('Egg rice bowl (gyeran bap)','계란밥','Korean','Breakfast','🍚🍳','pc',['rice','eggs','soy sauce','sesame oil','roasted seaweed'],['Egg','Soy','Wheat','Sesame'],'Fry an egg in a little oil. Put it on warm rice, add a splash of soy sauce and sesame oil, top with crumbled seaweed and mix.'),
    R('Korean rice porridge (juk)','죽','Korean','Breakfast','🥣🥕','cv',['rice','chicken broth','carrots','zucchini','scallions'],[],'Rinse ½ cup rice. Simmer in 4 cups broth for 25 minutes, stirring often. Add finely chopped carrots and zucchini for the last 5 minutes. Top with scallions.'),
    R('Oatmeal and berries','','American','Breakfast','🥣🫐','cv',['oats','milk','berries','honey'],['Milk'],'Simmer oats in milk for 5 minutes. Top with berries and a drizzle of honey.'),
    R('Smoothie bowl','','American','Breakfast','🍓🍌','cv',['frozen berries','bananas','yogurt','granola'],['Milk'],'Blend frozen berries, half a banana and yogurt until thick. Pour into a bowl and top with banana slices and granola.'),
    R('Yogurt fruit bowl','','American','Breakfast','🥛🍓','pv',['Greek yogurt','strawberries','blueberries','honey'],['Milk'],'Spoon yogurt into a bowl, add fruit and a little honey.'),
    R('Avocado toast and eggs','','American','Breakfast','🥑🍳','pcv',['bread','avocados','eggs','salt'],['Wheat','Egg'],'Toast the bread, mash avocado on top with a pinch of salt, and add a fried or boiled egg.'),
    R('Pancakes with berries','','American','Breakfast','🥞🍓','cv',['pancake mix','milk','eggs','berries'],['Wheat','Egg','Milk'],'Mix batter, cook small pancakes on a medium pan until bubbles form, flip once. Serve with berries.'),
    R('Eggs and toast','','American','Breakfast','🍳🍞','pc',['eggs','bread','oranges'],['Egg','Wheat'],'Scramble eggs over low heat, serve with toast and orange slices.'),
    R('Bibimbap','비빔밥','Korean','Lunch','🍚🥕','pcv',['rice','beef','spinach','carrots','bean sprouts','eggs','gochujang','sesame oil'],['Egg','Soy','Wheat','Sesame'],'Cook beef and each vegetable separately. Arrange over rice, top with a fried egg, a little gochujang and sesame oil. Mix before eating.'),
    R('Kimbap','김밥','Korean','Lunch','🍙🥒','pcv',['rice','seaweed sheets','eggs','carrots','spinach','cucumber','sesame oil'],['Egg','Sesame'],'Season rice with sesame oil. Spread on seaweed, line up egg strips and vegetables, roll tightly and slice.'),
    R('Bulgogi wrap','불고기 랩','Korean','Lunch','🌯🥩','pcv',['tortillas','beef','lettuce','carrots','soy sauce','garlic'],['Wheat','Soy'],'Cook thin beef with soy sauce and garlic. Wrap in a tortilla with lettuce and shredded carrot.'),
    R('Chicken rice bowl (dakgalbi)','닭갈비 덮밥','Korean','Lunch','🍗🍚','pcv',['chicken thighs','gochujang','cabbage','sweet potatoes','rice'],['Soy','Wheat'],'Stir-fry chicken with cabbage and sweet potato in a mild gochujang sauce until cooked through. Serve over rice.'),
    R('Banh mi','','Vietnamese','Lunch','🥖🥕','pcv',['baguette','chicken','pickled carrots','cucumber','cilantro','mayonnaise'],['Wheat','Egg'],'Fill a toasted baguette with sliced chicken, pickled carrots, cucumber, cilantro and a little mayo.'),
    R('Fresh spring rolls','gỏi cuốn','Vietnamese','Lunch','🥬🍤','pcv',['rice paper','shrimp','rice noodles','lettuce','mint','cucumber'],['Shellfish'],'Dip rice paper in warm water, add lettuce, noodles, shrimp and herbs, then roll up. Serve with a dipping sauce your family is safe with.'),
    R('Chicken wrap with veggies','','American','Lunch','🌯🥗','pcv',['tortillas','chicken','lettuce','tomatoes','cheese'],['Wheat','Milk'],'Fill a tortilla with sliced chicken, lettuce, tomato and cheese. Roll and cut in half.'),
    R('Tuna rice and seaweed','','American','Lunch','🐟🍙','pc',['canned tuna','rice','roasted seaweed','cucumber','mayonnaise'],['Fish','Egg'],'Mix tuna with a little mayo. Scoop onto rice with cucumber and eat wrapped in seaweed squares.'),
    R('Quinoa veggie bowl','','American','Lunch','🥗🌽','cv',['quinoa','corn','black beans','cherry tomatoes','avocados'],[],'Cook quinoa, then top with corn, beans, tomatoes and avocado. Add lime juice and salt.'),
    R('Turkey wraps','','American','Lunch','🌯🦃','pcv',['tortillas','turkey','lettuce','tomatoes'],['Wheat'],'Layer turkey, lettuce and tomato on a tortilla and roll up.'),
    R('Bulgogi rice bowls','불고기','Korean','Dinner','🥩🍚','pcv',['beef','soy sauce','pear','garlic','onion','rice','lettuce'],['Soy','Wheat','Sesame'],'Marinate thin beef in soy sauce, grated pear and garlic for 30 minutes. Cook quickly in a hot pan with onion. Serve with rice and lettuce.'),
    R('Kimchi fried rice','김치볶음밥','Korean','Dinner','🍳🌶️','pcv',['rice','kimchi','eggs','scallions','sesame oil'],['Egg','Sesame','Fish'],'Stir-fry chopped kimchi, add cold rice and fry until hot. Top with a fried egg and scallions. (Many kimchi contain fish sauce.)'),
    R('Doenjang stew','된장찌개','Korean','Dinner','🍲🥢','pv',['doenjang soybean paste','tofu','zucchini','potatoes','onion','rice'],['Soy'],'Simmer potato and onion in water with doenjang for 10 minutes. Add zucchini and tofu and cook 5 more minutes. Serve with rice.'),
    R('Japchae','잡채','Korean','Dinner','🍜🥕','pcv',['sweet potato noodles','beef','spinach','carrots','mushrooms','soy sauce','sesame oil'],['Soy','Wheat','Sesame'],'Boil noodles, rinse. Stir-fry beef and vegetables, then toss everything with soy sauce, a little sugar and sesame oil.'),
    R('Soy garlic chicken','간장 치킨','Korean','Dinner','🍗🍚','pc',['chicken thighs','soy sauce','garlic','honey','rice','broccoli'],['Soy','Wheat'],'Pan-fry chicken pieces until cooked, then glaze with soy sauce, garlic and honey. Serve with rice and broccoli.'),
    R('Pho ga','phở gà','Vietnamese','Dinner','🍜🐔','pcv',['rice noodles','chicken','chicken broth','ginger','onion','bean sprouts','cilantro','lime'],['Fish'],'Simmer broth with charred ginger and onion for 20 minutes, season with a little fish sauce. Pour over noodles and sliced chicken; top with herbs and lime.'),
    R('Bun thit nuong','bún thịt nướng','Vietnamese','Dinner','🍜🍖','pcv',['pork','rice noodles','lettuce','cucumber','carrots','fish sauce'],['Fish'],'Grill marinated pork slices. Serve over noodles with lettuce, cucumber and carrots, with diluted fish sauce to pour over.'),
    R('Vietnamese chicken rice','cơm gà','Vietnamese','Dinner','🍗🍚','pcv',['chicken','rice','cucumber','ginger','scallions'],[],'Poach chicken with ginger, cook rice in the broth, and serve with sliced cucumber and scallions.'),
    R('Salmon and broccoli','','American','Dinner','🐟🥦','pcv',['salmon','broccoli','rice','olive oil','lemon'],['Fish'],'Bake salmon and broccoli with olive oil at 400°F (200°C) for 12–15 minutes. Serve with rice and lemon.'),
    R('Pasta and meatballs','','American','Dinner','🍝🍅','pcv',['spaghetti','meatballs','tomato sauce','parmesan'],['Wheat','Egg','Milk'],'Simmer meatballs in tomato sauce until cooked through. Toss with cooked spaghetti and a little parmesan.'),
    R('Chicken stir-fry','','American','Dinner','🥘🥦','pcv',['chicken','broccoli','carrots','rice','soy sauce'],['Soy','Wheat'],'Stir-fry chicken strips, add vegetables and a splash of soy sauce, cook until tender. Serve over rice.'),
    R('Taco night','','American','Dinner','🌮🥑','pcv',['corn tortillas','ground turkey','lettuce','tomatoes','cheese','avocados'],['Milk'],'Brown turkey with taco seasoning. Let everyone fill their own tortillas with toppings.'),
    R('Rice balls (jumeokbap)','주먹밥','Korean','Fuel before','🍙✨','c',['rice','roasted seaweed','sesame oil'],['Sesame'],'Mix warm rice with crumbled seaweed and a few drops of sesame oil. Shape into small balls with damp hands.'),
    R('Steamed sweet potato (goguma)','고구마','Korean','Fuel before','🍠','cv',['sweet potatoes'],[],'Steam or bake whole sweet potatoes until soft (about 40 minutes at 400°F / 200°C). Easy to pack warm or cold.'),
    R('Sticky rice (xoi)','xôi','Vietnamese','Fuel before','🍚🫘','c',['sticky rice','mung beans'],[],'Soak sticky rice and mung beans overnight, then steam together for 30–40 minutes.'),
    R('Banana oatmeal','','American','Fuel before','🥣🍌','cv',['oats','bananas','milk'],['Milk'],'Cook oats in milk and stir in sliced banana. Light and easy before practice.'),
    R('Toast with honey and banana','','American','Fuel before','🍞🍌','cv',['bread','honey','bananas'],['Wheat'],'Toast bread, drizzle with honey and top with banana slices.'),
    R('Chicken rice soup (chao ga)','cháo gà','Vietnamese','Recover after','🥣🐔','pc',['rice','chicken','ginger','scallions'],[],'Simmer rice in chicken broth with ginger until creamy, add shredded chicken and scallions.'),
    R('Chocolate milk and fruit','','American','Recover after','🥛🍊','pcv',['chocolate milk','oranges'],['Milk'],'A cold glass of chocolate milk with orange slices right after practice.'),
    R('Banana yogurt smoothie','','American','Recover after','🥤🍌','pcv',['bananas','yogurt','milk','berries'],['Milk'],'Blend banana, yogurt, milk and berries until smooth.'),
    R('Turkey and cheese roll-ups','','American','Recover after','🦃🧀','pc',['tortillas','turkey','cheese'],['Wheat','Milk'],'Roll turkey and cheese in a tortilla and slice into pinwheels.'),
    R('Mini kimbap rolls','꼬마김밥','Korean','Snacks','🍙🥕','cv',['rice','seaweed sheets','carrots','cucumber','sesame oil'],['Sesame'],'Cut seaweed into quarters, add a thin layer of rice and a stick of carrot and cucumber, roll tightly. Great for tournament bags.'),
    R('Rice cakes and fruit','떡 + 과일','Korean','Snacks','🍡🍓','cv',['Korean rice cakes','apples','grapes'],[],'Serve soft rice cakes with sliced apples and grapes.'),
    R('Edamame','에다마메','Korean','Snacks','🫛','pv',['edamame','salt'],['Soy'],'Boil frozen edamame for 4 minutes, drain and sprinkle with a little salt.'),
    R('Steamed buns (banh bao)','bánh bao','Vietnamese','Snacks','🥟','pc',['steamed buns'],['Wheat','Egg'],'Steam frozen buns for 10–12 minutes until hot in the middle.'),
    R('Mandarins and cheese','','American','Snacks','🍊🧀','pv',['mandarin oranges','cheese cubes'],['Milk'],'Peel mandarins and serve with cheese cubes.'),
    R('Apples and sunflower butter','','American','Snacks','🍎🌻','pv',['apples','sunflower butter'],[],'Slice apples and serve with sunflower butter for dipping (a nut-free choice).'),
    R('Orange slices and pretzels','','American','Snacks','🍊🥨','cv',['oranges','pretzels'],['Wheat'],'Pack orange wedges and a handful of pretzels. A classic between-games snack.'),
    R('String cheese and crackers','','American','Snacks','🧀🍘','pc',['string cheese','crackers'],['Milk','Wheat'],'Pack a cheese stick with whole-grain crackers.'),
    R('Nut-free trail mix','','American','Snacks','🥣🌻','c',['sunflower seeds','raisins','cereal'],[],'Mix sunflower seeds, raisins and cereal in small bags.'),
    R('Yogurt and granola','','American','Snacks','🥣🍯','pc',['yogurt','granola','honey'],['Milk','Tree nut'],'Layer yogurt and granola in a cup. Check the granola label for nuts.')
  ];
  const TINTS=['#ffe3ec','#ece6ff','#e3efff','#e2f6ec','#fff4d6','#ffe9dc','#fde6f3'];
  const TYPE_FROM_OLD={Snack:'Snacks','Tournament bag':'Snacks'};
  const normRecipe=r=>({...r,type:TYPE_FROM_OLD[r.type]||r.type||'Dinner',art:r.art||'🍽️',groups:r.groups||'',allergens:r.allergens||[],ingredients:r.ingredients||[],steps:r.steps||r.instructions||'',custom:true});

  /* ---------- Data ---------- */
  function migrate(){
    if(Array.isArray(data.planMeals))return;
    data.planMeals=[];
    const wk=weekDates(0);
    for(const m of Array.isArray(data.meals)?data.meals:[]){
      const i=WEEKDAYS.indexOf(m.day); if(i<0||!m.name)continue;
      const plan=['practice','tournament'].includes(data.dayTypes?.[m.day])?'sports':'regular';
      let slot=TYPE_FROM_OLD[m.type]||m.type;
      if(slot==='Tournament bag')slot='Snacks';
      if(!PLANS[plan].slots.includes(slot))slot='Snacks';
      data.planMeals.push({id:m.id||id(),plan,date:wk[i],slot,name:m.name});
    }
  }
  const load=()=>{try{data={...defaults(),...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch{data=defaults();}
    if(!Array.isArray(data.favorites))data.favorites=[]; if(!data.groceryChecked||typeof data.groceryChecked!=='object')data.groceryChecked={}; migrate();};
  load();
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(data));}catch{alert('Could not save on this device. Free up space and try again.');}window.littleDaysSportsSync?.queue();window.dispatchEvent(new Event('littledays:saved'));};
  window.addEventListener('little-days-sports-remote',()=>{load();if(active)render();});
  window.addEventListener('little-days-sports-conflict',()=>alert('Another parent updated the meal plan at the same time. The family version was reloaded. Please check your changes.'));

  const pref=()=>data.preferences||(data.preferences={cuisines:['Korean','Vietnamese','American'],allergies:[],servings:4});
  const allRecipes=()=>[...BUILT_IN,...(data.customRecipes||[]).map(normRecipe)];
  const allowed=r=>pref().cuisines.includes(r.cuisine)&&!r.allergens.some(a=>pref().allergies.includes(a));
  const recipeFor=name=>allRecipes().find(r=>r.name===name);
  const isFav=name=>data.favorites.includes(name);
  const fits=(r,slot)=>r.type===slot||(slot==='Snacks'&&r.type==='Fuel before')||(slot==='Fuel before'&&r.type==='Snacks'&&r.groups.includes('c'))||(slot==='Recover after'&&r.type==='Breakfast'&&r.groups.includes('p'));
  const mealsAt=(plan,date,slot)=>(data.planMeals||[]).filter(m=>m.plan===plan&&m.date===date&&m.slot===slot);

  /* ---------- Entry points ---------- */
  const panel=document.createElement('section');
  panel.id='sportsMealsView'; panel.className='hidden'; panel.setAttribute('aria-label','Meal plan');
  document.querySelector('#main')?.append(panel);
  const nav=document.querySelector('.rail');
  const railButton=document.createElement('button');
  railButton.type='button'; railButton.className='tab sports-meals-entry'; railButton.innerHTML='<svg aria-hidden="true"><use href="#i-bowl"/></svg><span>Meal Plan</span>';
  nav?.insertBefore(railButton,nav.querySelector('.add-btn'));
  const barButton=document.querySelector('.tabbar [data-meals-tab]');
  let active=false, tab='plan', plan=localStorage.getItem('ld_meal_plan_kind')==='sports'?'sports':'regular', week=0, phoneDay=null, search='';
  function open(){
    active=true;
    document.querySelectorAll('[data-page]').forEach(el=>el.classList.add('hidden'));
    panel.classList.remove('hidden');
    document.querySelectorAll('.tab[data-view]').forEach(b=>{b.classList.remove('active');b.removeAttribute('aria-current');});
    railButton.classList.add('active'); railButton.setAttribute('aria-current','page'); barButton?.setAttribute('aria-current','page');
    render(); window.scrollTo(0,0);
  }
  function close(){active=false;closeSheet();panel.classList.add('hidden');railButton.classList.remove('active');railButton.removeAttribute('aria-current');barButton?.removeAttribute('aria-current');}
  window.littleDaysSportsMeals={open};
  railButton.addEventListener('click',open);
  barButton?.addEventListener('click',open);
  document.addEventListener('click',e=>{if(active && e.target.closest('[data-view]'))close();},true);

  /* ---------- Pieces ---------- */
  const art=(r,size='')=>{const a=[...(r?.art||'🍽️')];const tint=TINTS[[...(r?.name||'x')].reduce((s,c)=>s+c.charCodeAt(0),0)%TINTS.length];
    return `<span class="mp-plate ${size}" style="--tint:${tint}" aria-hidden="true"><span class="mp-plate-main">${a[0]}</span>${a.length>1?`<span class="mp-plate-side">${a.slice(1).join('')}</span>`:''}</span>`;};
  const shortDate=k=>parse(k).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  const rangeLabel=w=>{const a=parse(w[0]),b=parse(w[6]);
    try{return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).formatRange(a,b);}
    catch{return `${a.toLocaleDateString(undefined,{month:'short',day:'numeric'})} – ${b.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`;}};
  const recipeCard=(r,extra='')=>`<button type="button" class="mp-rcard" data-recipe="${esc(r.name)}">${art(r)}<span class="mp-rname">${esc(r.name)}</span>${r.native?`<span class="mp-rnative">${esc(r.native)}</span>`:''}<span class="mp-rmeta">${esc(r.cuisine)} · ${esc(r.type)}${isFav(r.name)?' · ❤️':''}</span>${extra}</button>`;

  /* ---------- Render ---------- */
  function render(){
    if(!active)return;
    const w=weekDates(week), today=keyOf(new Date());
    if(!phoneDay||!w.includes(phoneDay))phoneDay=w.includes(today)?today:w[0];
    const TABS=[['plan','📅','Weekly plan'],['recipes','👩‍🍳','Recipes'],['grocery','🛒','Grocery list'],['favorites','❤️','Favorites'],['korean','🇰🇷','Korean food'],['filters','⚙️','Filters']];
    panel.innerHTML=`<header class="mp-head"><div class="mp-title"><span class="mp-title-icon" aria-hidden="true">🍴</span><div><h1>Meal Plan</h1><p class="sub">Healthy kids · Happy families · Stronger together 💗</p></div></div>
      <div class="mp-weeknav"><button type="button" class="mp-arrow" data-week="-1" aria-label="Previous week">‹</button><strong>${rangeLabel(w)}</strong><button type="button" class="mp-arrow" data-week="1" aria-label="Next week">›</button>
      ${week!==0?'<button type="button" class="mp-thisweek" data-week="0">📅 This week</button>':''}</div></header>
      <div class="mp-plans" role="group" aria-label="Which meal plan">${Object.entries(PLANS).map(([k,p])=>`<button type="button" data-plan="${k}" class="${plan===k?'chosen':''}" aria-pressed="${plan===k}"><span aria-hidden="true">${p.icon}</span> ${p.label}</button>`).join('')}</div>
      <nav class="mp-tabs" aria-label="Meal plan sections">${TABS.map(([k,i,l])=>`<button type="button" data-tab="${k}" class="mp-tab-${k} ${tab===k?'chosen':''}" aria-current="${tab===k?'page':'false'}"><span aria-hidden="true">${i}</span>${l}</button>`).join('')}</nav>
      <div class="mp-body">${tab==='plan'?planHTML(w,today):tab==='grocery'?groceryHTML(w):tab==='filters'?filtersHTML():recipesHTML(tab)}</div>`;
    wire(w);
  }

  function planHTML(w,today){
    const slots=PLANS[plan].slots;
    const cell=(date,slot)=>{const ms=mealsAt(plan,date,slot);
      return `<div class="mp-cell">${ms.map(m=>{const r=recipeFor(m.name);return `<button type="button" class="mp-meal" data-meal="${esc(m.id)}">${art(r||{name:m.name,art:'🍽️'})}<span>${esc(m.name)}</span>${r?.native?`<small>${esc(r.native)}</small>`:''}</button>`;}).join('')}
        <button type="button" class="mp-add" data-add="${date}|${esc(slot)}" aria-label="Add ${esc(slot)} on ${esc(shortDate(date))}">＋</button></div>`;};
    const grid=`<div class="mp-grid-wrap"><div class="mp-grid" style="--rows:${slots.length}">
      <div class="mp-corner"></div>${w.map((d,i)=>`<div class="mp-dayhead mp-c${i}${d===today?' is-today':''}"><b>${WD[i]}</b><span>${esc(shortDate(d))}</span></div>`).join('')}
      ${slots.map(s=>`<div class="mp-rowhead"><span aria-hidden="true">${SLOT_ICON[s]}</span><b>${esc(s)}</b>${SLOT_HINT[s]?`<small>${SLOT_HINT[s]}</small>`:''}</div>${w.map(d=>cell(d,s)).join('')}`).join('')}
    </div></div>`;
    const phone=`<div class="mp-phone"><div class="mp-daychips">${w.map((d,i)=>`<button type="button" data-pday="${d}" class="mp-c${i} ${d===phoneDay?'chosen':''}${d===today?' is-today':''}"><b>${WD[i]}</b><span>${parse(d).getDate()}</span></button>`).join('')}</div>
      ${slots.map(s=>`<div class="mp-prow"><div class="mp-prow-head"><span aria-hidden="true">${SLOT_ICON[s]}</span><b>${esc(s)}</b>${SLOT_HINT[s]?`<small>${SLOT_HINT[s]}</small>`:''}</div>${cell(phoneDay,s)}</div>`).join('')}</div>`;
    const day=phoneDay, dayMeals=(data.planMeals||[]).filter(m=>m.plan===plan&&m.date===day);
    const groups=new Set(dayMeals.flatMap(m=>[...(recipeFor(m.name)?.groups||'')]));
    const korean=allRecipes().filter(r=>r.cuisine==='Korean'&&allowed(r)).slice(0,10);
    return `${grid}${phone}
      <div class="mp-lower">
        <div class="sm-card mp-quick"><h2>Quick add</h2><div class="mp-quick-grid">
          <button type="button" data-quick="recipes">👩‍🍳 Add from recipes</button><button type="button" data-quick="korean">🇰🇷 Add Korean food</button>
          <button type="button" data-quick="repeat">🔁 Repeat last week</button><button type="button" data-quick="fill">✨ Fill empty meals</button>
          ${plan==='regular'?'<button type="button" data-quick="tournament">🏆 Plan for tournament</button>':''}<button type="button" data-quick="clear">🧹 Clear this week</button></div></div>
        <div class="sm-card mp-balance"><h2>Balanced plate <small>${esc(parse(day).toLocaleDateString(undefined,{weekday:'long'}))}</small></h2>
          <div class="mp-groups">${[['p','🍗','Protein'],['c','🍚','Carbs'],['v','🥦','Fruits & veggies']].map(([g,i,l])=>`<div class="${groups.has(g)?'on':''}"><span aria-hidden="true">${i}</span><b>${l}</b><small>${groups.has(g)?'✓ planned':'add some'}</small></div>`).join('')}</div>
          <p class="sub">A simple check of what's planned — not medical or nutrition advice.</p></div>
        ${plan==='sports'?`<div class="sm-card mp-tips"><h2>🏆 Tournament day</h2><ul>
          <li>Familiar breakfast 2–3 hours before</li><li>Hydrate well — water all day</li><li>Easy-to-digest foods</li><li>Pack healthy snacks for between matches</li><li>Avoid trying new foods on game day</li></ul></div>`:''}
      </div>
      <div class="sm-card mp-popular"><h2>Popular Korean recipes</h2><div class="mp-strip">${korean.map(r=>recipeCard(r)).join('')}</div></div>
      <p class="sm-note">Each plan has its own week. Meal plans, recipes and grocery lists sync with your family when signed in.</p>`;
  }

  function recipesHTML(kind){
    let list=allRecipes().filter(allowed);
    if(kind==='favorites')list=allRecipes().filter(r=>isFav(r.name));
    if(kind==='korean')list=allRecipes().filter(r=>r.cuisine==='Korean'&&allowed(r));
    const q=search.trim().toLowerCase();
    if(q)list=list.filter(r=>(r.name+' '+(r.native||'')+' '+r.ingredients.join(' ')).toLowerCase().includes(q));
    const order=['Breakfast','Lunch','Dinner','Fuel before','Recover after','Snacks'];
    const groups=order.map(t=>[t,list.filter(r=>r.type===t)]).filter(([,l])=>l.length);
    const empty=kind==='favorites'?'<p class="sub">Tap ❤️ on any recipe to save it here.</p>':'<p class="sub">No recipes match. Try another search or check Filters.</p>';
    return `<div class="mp-searchrow"><input type="search" id="mpSearch" placeholder="Search recipes or ingredients" value="${esc(search)}" aria-label="Search recipes">
      ${kind==='recipes'?'<button type="button" class="btn primary" id="mpNewRecipe">＋ Create recipe</button>':''}</div>
      ${groups.length?groups.map(([t,l])=>`<h2 class="mp-group">${SLOT_ICON[t]} ${esc(t)}</h2><div class="mp-rgrid">${l.map(r=>recipeCard(r)).join('')}</div>`).join(''):empty}`;
  }

  const grocery=w=>{
    const items=new Map();
    for(const m of (data.planMeals||[]).filter(m=>m.plan===plan&&w.includes(m.date))){const r=recipeFor(m.name);if(!r)continue;
      for(const i of r.ingredients)items.set(i,(items.get(i)||0)+1);}
    return [...items].sort((a,b)=>a[0].localeCompare(b[0]));
  };
  function groceryHTML(w){
    const items=grocery(w), left=items.filter(([i])=>!data.groceryChecked[i]).length;
    return `<div class="sm-card"><h2>🛒 Grocery list <small class="mp-count">${PLANS[plan].label} · ${esc(rangeLabel(w))}</small></h2>
      ${items.length?`<p class="sub">${left} of ${items.length} left to buy</p>${items.map(([item,n])=>`<label class="sm-check"><input type="checkbox" data-grocery="${esc(item)}" ${data.groceryChecked[item]?'checked':''}><span>${esc(item)}${n>1?` <small>· ${n} meals</small>`:''}</span></label>`).join('')}
      <div class="sm-actions"><button type="button" class="btn" id="mpCopy">Copy list</button><button type="button" class="btn" id="mpUncheck">Uncheck all</button></div>`
      :'<p class="sub">Add recipes to this week’s plan and their ingredients appear here.</p>'}
      <p class="sub">Counts show how many meals use an item, not amounts. Always check labels for allergens.</p></div>`;
  }
  function filtersHTML(){
    return `<div class="sm-card"><h2>Cuisines</h2>${['Korean','Vietnamese','American'].map(c=>`<label class="sm-check"><input type="checkbox" data-cuisine="${c}" ${pref().cuisines.includes(c)?'checked':''}>${c}</label>`).join('')}
      <h2>Allergies / avoid</h2>${['Milk','Egg','Wheat','Soy','Sesame','Fish','Shellfish','Peanut','Tree nut'].map(a=>`<label class="sm-check"><input type="checkbox" data-allergen="${a}" ${pref().allergies.includes(a)?'checked':''}>${a}</label>`).join('')}
      <p class="sub">Filters are a guide only. Sauces like soy sauce and gochujang usually contain wheat, and many kimchi contain fish sauce — always check labels and cross-contact.</p></div>`;
  }

  /* ---------- Sheet (picker, recipe details, create) ---------- */
  let sheetEl=null;
  function sheet(html){
    closeSheet();
    sheetEl=document.createElement('div'); sheetEl.className='mp-scrim';
    sheetEl.innerHTML=`<div class="mp-sheet" role="dialog" aria-modal="true">${html}</div>`;
    sheetEl.addEventListener('click',e=>{if(e.target===sheetEl||e.target.closest('[data-close]'))closeSheet();});
    document.body.append(sheetEl); document.documentElement.classList.add('mp-locked');
    return sheetEl.querySelector('.mp-sheet');
  }
  function closeSheet(){sheetEl?.remove();sheetEl=null;document.documentElement.classList.remove('mp-locked');}

  function openPicker(date,slot){
    const list=allRecipes().filter(allowed), best=list.filter(r=>fits(r,slot)), favs=list.filter(r=>isFav(r.name)&&!best.includes(r)), rest=list.filter(r=>!best.includes(r)&&!favs.includes(r));
    const s=sheet(`<div class="mp-sheet-head"><div><h2>Add ${esc(slot)}</h2><p class="sub">${esc(parse(date).toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'}))} · ${PLANS[plan].label}</p></div><button type="button" class="mp-x" data-close aria-label="Close">✕</button></div>
      <input type="search" class="mp-sheet-search" placeholder="Search recipes" aria-label="Search recipes">
      <div class="mp-own"><input type="text" maxlength="100" placeholder="Or type your own meal…" aria-label="Your own meal"><button type="button" class="btn primary">Add</button></div>
      <div class="mp-sheet-list">${best.length?`<h3>Best for ${esc(slot)}</h3><div class="mp-rgrid">${best.map(r=>recipeCard(r)).join('')}</div>`:''}
      ${favs.length?`<h3>❤️ Favorites</h3><div class="mp-rgrid">${favs.map(r=>recipeCard(r)).join('')}</div>`:''}
      <h3>All recipes</h3><div class="mp-rgrid">${rest.map(r=>recipeCard(r)).join('')}</div></div>`);
    const add=name=>{if(!name)return;data.planMeals.push({id:id(),plan,date,slot,name:name.slice(0,100)});save();closeSheet();render();};
    s.querySelectorAll('[data-recipe]').forEach(b=>b.onclick=()=>add(b.dataset.recipe));
    const own=s.querySelector('.mp-own input');
    s.querySelector('.mp-own button').onclick=()=>add(own.value.trim());
    own.onkeydown=e=>{if(e.key==='Enter')add(own.value.trim());};
    s.querySelector('.mp-sheet-search').oninput=e=>{const q=e.target.value.toLowerCase();
      s.querySelectorAll('[data-recipe]').forEach(b=>{const r=recipeFor(b.dataset.recipe);b.hidden=!!q&&!(r.name+' '+(r.native||'')+' '+r.ingredients.join(' ')).toLowerCase().includes(q);});};
  }

  function openRecipe(name,{mealId}={}){
    const r=recipeFor(name), meal=mealId?(data.planMeals||[]).find(m=>m.id===mealId):null;
    const w=weekDates(week);
    const s=sheet(`<div class="mp-sheet-head"><div class="mp-detail-title">${art(r||{name,art:'🍽️'},'big')}<div><h2>${esc(name)}</h2>${r?.native?`<p class="mp-rnative">${esc(r.native)}</p>`:''}${r?`<p class="sub">${esc(r.cuisine)} · best for ${esc(r.type)}</p>`:''}</div></div><button type="button" class="mp-x" data-close aria-label="Close">✕</button></div>
      ${r?`<button type="button" class="mp-fav ${isFav(name)?'on':''}" id="mpFav">${isFav(name)?'❤️ Saved to favorites':'🤍 Save to favorites'}</button>
      <h3>Ingredients</h3><ul class="mp-ingr">${r.ingredients.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>
      ${r.steps?`<h3>How to make it</h3><p class="mp-steps">${esc(r.steps)}</p>`:''}
      ${r.allergens.length?`<p class="mp-allergens">Contains: ${esc(r.allergens.join(', '))}</p>`:''}`:'<p class="sub">Your own meal (not a saved recipe).</p>'}
      ${meal?`<div class="sm-actions"><button type="button" class="btn" id="mpReplace">Replace</button><button type="button" class="btn" id="mpRemove">Remove from plan</button></div>`
      :`<h3>Add to plan</h3><div class="mp-addto"><select id="mpToPlan">${Object.entries(PLANS).map(([k,p])=>`<option value="${k}"${k===plan?' selected':''}>${p.icon} ${p.label}</option>`).join('')}</select>
        <select id="mpToDay">${w.map((d,i)=>`<option value="${d}">${WD[i]} ${esc(shortDate(d))}</option>`).join('')}</select>
        <select id="mpToSlot"></select><button type="button" class="btn primary" id="mpAddTo">Add</button></div>`}
      ${r?.custom?'<p><button type="button" class="link-btn" id="mpDelRecipe">Delete this recipe</button></p>':''}`);
    s.querySelector('#mpFav')?.addEventListener('click',()=>{data.favorites=isFav(name)?data.favorites.filter(x=>x!==name):[...data.favorites,name];save();openRecipe(name,{mealId});render();});
    if(meal){
      s.querySelector('#mpRemove').onclick=()=>{data.planMeals=data.planMeals.filter(m=>m.id!==mealId);save();closeSheet();render();};
      s.querySelector('#mpReplace').onclick=()=>{data.planMeals=data.planMeals.filter(m=>m.id!==mealId);save();render();openPicker(meal.date,meal.slot);};
    }else{
      const ps=s.querySelector('#mpToPlan'), ss=s.querySelector('#mpToSlot');
      const fill=()=>{ss.innerHTML=PLANS[ps.value].slots.map(x=>`<option${r&&fits(r,x)&&!ss.dataset.done?' selected':''}>${esc(x)}</option>`).join('');};
      fill(); ps.onchange=fill;
      s.querySelector('#mpAddTo').onclick=()=>{data.planMeals.push({id:id(),plan:ps.value,date:s.querySelector('#mpToDay').value,slot:ss.value,name});save();closeSheet();
        if(ps.value!==plan){plan=ps.value;localStorage.setItem('ld_meal_plan_kind',plan);} tab='plan'; render(); toastMsg(`Added ${name}`);};
    }
    s.querySelector('#mpDelRecipe')?.addEventListener('click',()=>{if(!confirm(`Delete the recipe “${name}”? Meals already planned stay.`))return;data.customRecipes=(data.customRecipes||[]).filter(x=>x.name!==name);save();closeSheet();render();});
  }

  function openCreate(){
    const ARTS=['🍲','🍜','🍚','🥗','🍝','🌮','🥪','🥞','🍗','🐟','🍙','🥟','🍎','🥤'];
    const s=sheet(`<div class="mp-sheet-head"><h2>Create a recipe — free</h2><button type="button" class="mp-x" data-close aria-label="Close">✕</button></div>
      <form class="sm-form" id="mpCreate"><label>Name<input name="name" maxlength="100" required></label>
      <div class="sm-row"><label>Cuisine<select name="cuisine"><option>Korean</option><option>Vietnamese</option><option>American</option></select></label>
      <label>Best for<select name="type">${['Breakfast','Lunch','Dinner','Snacks','Fuel before','Recover after'].map(x=>`<option>${x}</option>`).join('')}</select></label></div>
      <fieldset class="mp-artpick"><legend>Picture</legend>${ARTS.map((a,i)=>`<label><input type="radio" name="art" value="${a}"${i===0?' checked':''}><span>${a}</span></label>`).join('')}</fieldset>
      <label>Ingredients, one per line<textarea name="ingredients" rows="4" required></textarea></label>
      <label>How to make it<textarea name="steps" rows="4" required></textarea></label>
      <button class="btn primary" type="submit">Save recipe</button></form>
      <p class="sub">📷 Scanning a recipe from a photo is coming later as a premium feature. Nothing is charged.</p>`);
    s.querySelector('#mpCreate').onsubmit=e=>{
      e.preventDefault(); const f=new FormData(e.currentTarget), name=String(f.get('name')||'').trim();
      if(!name)return; if(allRecipes().some(r=>r.name.toLowerCase()===name.toLowerCase())){alert('A recipe with that name already exists.');return;}
      const ingredients=String(f.get('ingredients')||'').split(/\n|,/).map(x=>x.trim()).filter(Boolean), steps=String(f.get('steps')||'').trim();
      if(!ingredients.length||!steps)return;
      data.customRecipes=data.customRecipes||[];
      data.customRecipes.push({name,cuisine:String(f.get('cuisine')),type:String(f.get('type')),art:String(f.get('art')||'🍽️'),ingredients,instructions:steps,servings:4,allergens:[]});
      save(); closeSheet(); render(); toastMsg('Recipe saved');
    };
  }
  const toastMsg=t=>{if(typeof toast==='function')toast(t);};

  /* ---------- Quick actions ---------- */
  function fillWeek(p,w){
    const pool=allRecipes().filter(allowed); let n=0;
    for(const [i,d] of w.entries())for(const slot of PLANS[p].slots){
      if(mealsAt(p,d,slot).length)continue;
      const choices=pool.filter(r=>r.type===slot); if(!choices.length)continue;
      data.planMeals.push({id:id(),plan:p,date:d,slot,name:choices[(i*3+PLANS[p].slots.indexOf(slot)+n++)%choices.length].name});
    }
    return n;
  }
  function quick(k,w){
    if(k==='recipes'||k==='korean'){tab=k;search='';render();return;}
    if(k==='fill'){if(!confirm(`Fill empty meals this week in ${PLANS[plan].label}? Meals you planned stay.`))return;const n=fillWeek(plan,w);save();render();toastMsg(n?`Added ${n} meals`:'Every meal is already planned');return;}
    if(k==='tournament'){plan='sports';localStorage.setItem('ld_meal_plan_kind',plan);render();toastMsg('Switched to Sports meals — tap ＋ or Fill empty meals');return;}
    if(k==='repeat'){
      const prev=weekDates(week-1), src=(data.planMeals||[]).filter(m=>m.plan===plan&&prev.includes(m.date));
      if(!src.length){alert('Nothing was planned last week in this plan.');return;}
      let n=0; for(const m of src){const d=w[prev.indexOf(m.date)]; if(mealsAt(plan,d,m.slot).length)continue; data.planMeals.push({...m,id:id(),date:d}); n++;}
      save();render();toastMsg(n?`Copied ${n} meals from last week`:'This week already has those meals');return;
    }
    if(k==='clear'){if(!confirm(`Clear this week in ${PLANS[plan].label}?`))return;data.planMeals=data.planMeals.filter(m=>!(m.plan===plan&&w.includes(m.date)));save();render();}
  }

  /* ---------- Wiring ---------- */
  function wire(w){
    const qa=s=>panel.querySelectorAll(s);
    qa('[data-week]').forEach(b=>b.onclick=()=>{const v=Number(b.dataset.week);week=v===0?0:week+v;phoneDay=null;render();});
    qa('[data-plan]').forEach(b=>b.onclick=()=>{plan=b.dataset.plan;localStorage.setItem('ld_meal_plan_kind',plan);render();});
    qa('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;search='';render();});
    qa('[data-pday]').forEach(b=>b.onclick=()=>{phoneDay=b.dataset.pday;render();});
    qa('[data-add]').forEach(b=>b.onclick=()=>{const [d,...s]=b.dataset.add.split('|');openPicker(d,s.join('|'));});
    qa('[data-meal]').forEach(b=>b.onclick=()=>{const m=data.planMeals.find(x=>x.id===b.dataset.meal);if(m)openRecipe(m.name,{mealId:m.id});});
    qa('[data-recipe]').forEach(b=>b.onclick=()=>openRecipe(b.dataset.recipe));
    qa('[data-quick]').forEach(b=>b.onclick=()=>quick(b.dataset.quick,w));
    const sr=panel.querySelector('#mpSearch');
    if(sr){sr.oninput=()=>{search=sr.value;const pos=sr.selectionStart;render();const n=panel.querySelector('#mpSearch');n.focus();n.setSelectionRange(pos,pos);};}
    panel.querySelector('#mpNewRecipe')?.addEventListener('click',openCreate);
    panel.querySelector('#mpCopy')?.addEventListener('click',()=>{
      const list=grocery(w).filter(([i])=>!data.groceryChecked[i]).map(([n])=>'- '+n).join('\n');
      if(navigator.clipboard?.writeText)navigator.clipboard.writeText(list).then(()=>toastMsg('Grocery list copied')).catch(()=>prompt('Copy grocery list:',list));
      else prompt('Copy grocery list:',list);
    });
    panel.querySelector('#mpUncheck')?.addEventListener('click',()=>{data.groceryChecked={};save();render();});
    qa('[data-grocery]').forEach(b=>b.onchange=()=>{data.groceryChecked[b.dataset.grocery]=b.checked;save();render();});
    qa('[data-cuisine]').forEach(b=>b.onchange=()=>{const p=pref();p.cuisines=b.checked?[...new Set([...p.cuisines,b.dataset.cuisine])]:p.cuisines.filter(x=>x!==b.dataset.cuisine);save();render();});
    qa('[data-allergen]').forEach(b=>b.onchange=()=>{const p=pref();p.allergies=b.checked?[...new Set([...p.allergies,b.dataset.allergen])]:p.allergies.filter(x=>x!==b.dataset.allergen);save();render();});
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheetEl)closeSheet();});
})();
