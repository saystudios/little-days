/* Little Days Meal Plan: two weekly plans (Everyday meals and Sports meals),
   ready-to-cook recipes, favorites, filters and a grocery list. Family-synced.
   Stored under the old Sports & Meals key so saved recipes, preferences and
   lists carry over. Older weekday-based meals are copied into this week once. */
(() => {
  'use strict';
  const KEY = 'ld_sports_meals_v1';
  const defaults = () => ({events:[], meals:[], checklist:{}, dayTypes:{}, planMeals:null, favorites:[],
    preferences:{cuisines:['Korean','Vietnamese','American','Italian'],allergies:[],servings:4}, groceryChecked:{}, customRecipes:[]});
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
    sports:{label:'Sports meals',icon:'🏆',slots:['Breakfast','Fuel before','Between games','Lunch','Recover after','Dinner','Snacks']}};
  const SLOT_ICON={Breakfast:'☀️',Lunch:'🍴','Fuel before':'⚡','Between games':'🥤','Recover after':'💪',Dinner:'🌙',Snacks:'🍎'};
  const SLOT_HINT={'Fuel before':'30–60 min before playing','Between games':'tournament days: small bites + water','Recover after':'within an hour after playing'};

  /* ---------- Tournament day guide: timing, what to eat, what to avoid ----------
     foods: recipe names (tap to open) or plain foods. slot: where "Plan this day" puts the first food that fits the family's filters. */
  const TOURNEY={
    before:{label:'Before',icon:'⏰',rows:[
      {when:'Night before',what:'A familiar dinner with plenty of carbs (rice, noodles or pasta) and some protein. Drink water with it.',foods:['Pasta and meatballs','Vietnamese chicken rice','Bun thit nuong']},
      {when:'2–3 hours before',what:'Breakfast with carbs and a little protein. Keep it low in fat so it digests easily.',foods:['Banana oatmeal','Toast with honey and banana','Sticky rice (xoi)'],slot:'Breakfast'},
      {when:'30–60 minutes before',what:'A small, easy snack and a cup of water.',foods:['Rice balls (jumeokbap)','Steamed sweet potato (goguma)','Banana'],slot:'Fuel before'}],
      avoid:['New foods the child has never tried','Greasy or fried food (fries, donuts, bacon)','Lots of beans, raw veggies or high-fiber cereal right before','Soda and energy drinks','Playing on an empty stomach']},
    during:{label:'During',icon:'🥤',rows:[
      {when:'Every 15–20 minutes',what:'Small sips of water, even before feeling thirsty.',foods:['Water']},
      {when:'Short break (under 1 hour)',what:'Quick carbs that are easy on the stomach.',foods:['Orange slices and pretzels','Banana','Grapes (cut in half)'],slot:'Between games'},
      {when:'Long break (1–2+ hours)',what:'A light mini meal: carbs plus a little protein.',foods:['Mini kimbap rolls','Rice cakes and fruit','String cheese and crackers','Nut-free trail mix'],slot:'Lunch'},
      {when:'Long or hot days',what:'For play over an hour or in the heat, a sports drink can help. Otherwise water is best.',foods:['Water','Sports drink']}],
      avoid:['Big, heavy meals between games','Greasy concession-stand food (hot dogs, nachos, fries)','Candy and lots of sugar','Waiting until thirsty to drink','Energy drinks']},
    after:{label:'After',icon:'💪',rows:[
      {when:'Within 30–60 minutes',what:'Carbs plus protein to refuel tired muscles.',foods:['Chocolate milk and fruit','Banana yogurt smoothie','Turkey and cheese roll-ups'],slot:'Recover after'},
      {when:'Rest of the day',what:'Keep drinking water to replace what was lost in sweat.',foods:['Water']},
      {when:'Recovery dinner (within 2 hours)',what:'A balanced plate: protein, carbs and vegetables.',foods:['Chicken rice soup (chao ga)','Salmon and broccoli','Chicken stir-fry'],slot:'Dinner'}],
      avoid:['Skipping the meal after playing','Only chips, candy or fast food','Soda instead of water','Waiting many hours to eat']}};

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
    R('Yogurt and granola','','American','Snacks','🥣🍯','pc',['yogurt','granola','honey'],['Milk','Tree nut'],'Layer yogurt and granola in a cup. Check the granola label for nuts.'),
    /* More American */
    R('Turkey chili','','American','Dinner','🍲🫘','pcv',['ground turkey','kidney beans','tomatoes','onions','chili powder'],[],'Brown turkey with onions, add beans, tomatoes and chili powder, and simmer 25 minutes. Serve with rice or cornbread.'),
    R('Sheet-pan chicken and potatoes','','American','Dinner','🍗🥔','pcv',['chicken thighs','potatoes','green beans','olive oil'],[],'Toss chicken, cubed potatoes and green beans with olive oil and salt. Roast at 425°F (220°C) for 30–35 minutes.'),
    R('Baked chicken tenders','','American','Dinner','🍗🥕','pcv',['chicken breast','panko','eggs','carrots'],['Wheat','Egg'],'Dip chicken strips in egg, then panko. Bake at 425°F (220°C) for 15–18 minutes. Serve with carrot sticks.'),
    R('Turkey burgers and sweet potato fries','','American','Dinner','🍔🍠','pcv',['ground turkey','burger buns','sweet potatoes','lettuce'],['Wheat'],'Bake sweet potato wedges at 425°F (220°C) for 25 minutes. Grill or pan-cook turkey patties until no longer pink.'),
    R('Grilled cheese and tomato soup','','American','Lunch','🥪🍅','cv',['bread','cheese','butter','tomato soup'],['Wheat','Milk'],'Butter bread, add cheese and cook in a pan until golden on both sides. Serve with warm tomato soup.'),
    R('Chicken noodle soup','','American','Lunch','🍜🐔','pcv',['chicken','egg noodles','carrots','celery'],['Wheat','Egg'],'Simmer chicken, carrots and celery in broth for 20 minutes. Shred the chicken and add noodles for the last 8 minutes.'),
    R('Breakfast burrito','','American','Breakfast','🌯🍳','pcv',['tortillas','eggs','black beans','cheese','salsa'],['Wheat','Egg','Milk'],'Scramble eggs, then wrap with warm black beans, cheese and a spoon of salsa.'),
    R('French toast and fruit','','American','Breakfast','🍞🍓','pcv',['bread','eggs','milk','strawberries'],['Wheat','Egg','Milk'],'Dip bread in beaten egg and milk, cook in a pan until golden, and top with strawberries.'),
    R('Bagel with cream cheese and banana','','American','Fuel before','🥯🍌','c',['bagels','cream cheese','bananas'],['Wheat','Milk'],'Toast half a bagel, add a thin layer of cream cheese and serve with a banana.'),
    R('Cottage cheese and pineapple','','American','Recover after','🥛🍍','pv',['cottage cheese','pineapple'],['Milk'],'Spoon cottage cheese into a cup and top with pineapple chunks.'),
    R('Applesauce and graham crackers','','American','Snacks','🍎🍪','c',['applesauce pouches','graham crackers'],['Wheat'],'Pack an applesauce pouch with a few graham crackers. Easy to eat between games.'),
    /* Italian */
    R('Spaghetti bolognese','spaghetti alla bolognese','Italian','Dinner','🍝🍅','pcv',['spaghetti','ground beef','tomato sauce','carrots','onions','parmesan'],['Wheat','Milk'],'Brown beef with finely chopped onion and carrot, add tomato sauce and simmer 20 minutes. Toss with spaghetti and parmesan.'),
    R('Chicken parmesan and pasta','pollo alla parmigiana','Italian','Dinner','🍗🧀','pc',['chicken breast','breadcrumbs','eggs','marinara','mozzarella','pasta'],['Wheat','Egg','Milk'],'Bread thin chicken cutlets and bake at 425°F (220°C) for 15 minutes. Top with marinara and mozzarella, bake 5 more minutes. Serve with pasta.'),
    R('Baked ziti with spinach','ziti al forno','Italian','Dinner','🍝🥬','pcv',['ziti pasta','ricotta','mozzarella','tomato sauce','spinach'],['Wheat','Milk'],'Mix cooked ziti with tomato sauce, ricotta and spinach. Top with mozzarella and bake at 375°F (190°C) for 20 minutes.'),
    R('Homemade veggie pizza','pizza','Italian','Dinner','🍕🫑','cv',['pizza dough','tomato sauce','mozzarella','bell peppers'],['Wheat','Milk'],'Stretch dough, add sauce, cheese and peppers. Bake at 475°F (245°C) for 10–12 minutes. Kids can top their own.'),
    R('Chicken and pea risotto','risotto','Italian','Dinner','🍚🟢','pcv',['arborio rice','chicken broth','peas','chicken','parmesan'],['Milk'],'Stir rice in warm broth a ladle at a time for 18–20 minutes. Add peas, cooked chicken and parmesan.'),
    R('Minestrone soup','minestrone','Italian','Lunch','🥣🥕','cv',['small pasta','cannellini beans','carrots','zucchini','tomatoes'],['Wheat'],'Simmer vegetables and beans in broth with tomatoes for 20 minutes, add small pasta for the last 8.'),
    R('Pesto pasta with chicken','pasta al pesto','Italian','Lunch','🍝🌿','pcv',['pasta','basil pesto','chicken','cherry tomatoes'],['Wheat','Milk','Tree nut'],'Toss warm pasta with pesto, sliced cooked chicken and halved cherry tomatoes. Most pesto has pine nuts.'),
    R('Caprese pasta salad','insalata caprese','Italian','Lunch','🥗🍅','cv',['rotini','cherry tomatoes','mozzarella pearls','basil','olive oil'],['Wheat','Milk'],'Toss cooled pasta with tomatoes, mozzarella, basil and olive oil. Good cold in a lunch box.'),
    R('Pasta with olive oil and parmesan','pasta in bianco','Italian','Fuel before','🍝✨','c',['pasta','olive oil','parmesan'],['Wheat','Milk'],'Plain pasta with a little olive oil and parmesan, 2–3 hours before playing. Simple and easy to digest.'),
    R('Pasta and bean soup','pasta e fagioli','Italian','Recover after','🥣🫘','pcv',['small pasta','cannellini beans','tomatoes','carrots'],['Wheat'],'Simmer beans, tomatoes and carrots in broth, then cook small pasta in it until soft.'),
    R('Veggie frittata','frittata','Italian','Breakfast','🍳🫑','pv',['eggs','spinach','bell peppers','parmesan'],['Egg','Milk'],'Cook peppers and spinach in an oven-safe pan, pour in beaten eggs with parmesan, and bake at 375°F (190°C) for 12 minutes.'),
    R('Tomato bruschetta','bruschetta','Italian','Snacks','🍞🍅','cv',['bread','tomatoes','basil','olive oil'],['Wheat'],'Toast bread slices and top with chopped tomatoes, basil and a drizzle of olive oil.'),
    /* Growing strong: protein, calcium and iron */
    R('Bulgogi rice bowl','불고기 덮밥','Korean','Dinner','🥩🍚','pcv',['beef','rice','carrots','spinach','soy sauce','sesame oil'],['Soy','Wheat','Sesame'],'Marinate thin beef in soy sauce, a little sugar and sesame oil for 20 minutes. Stir-fry and serve over rice with sautéed spinach and carrots.'),
    R('Steamed egg (gyeran-jjim)','계란찜','Korean','Breakfast','🥚☁️','p',['eggs','water','scallions'],['Egg'],'Whisk eggs with an equal amount of water and a pinch of salt. Steam or microwave gently until set and fluffy. Top with scallions.'),
    R('Mild soft tofu soup','순두부찌개','Korean','Dinner','🍲🥚','pcv',['soft tofu','eggs','zucchini','rice'],['Soy','Egg'],'Simmer zucchini in broth, add soft tofu in spoonfuls, crack in an egg and cook 3 minutes. Serve with rice. Leave out the chili for kids.'),
    R('Beef pho (pho bo)','phở bò','Vietnamese','Dinner','🍜🥩','pcv',['beef','rice noodles','bean sprouts','basil','fish sauce'],['Fish'],'Pour hot beef broth over rice noodles and thin raw beef slices so they cook in the bowl. Add herbs and bean sprouts.'),
    R('Tofu in tomato sauce','đậu phụ sốt cà chua','Vietnamese','Dinner','🍅🧈','pcv',['firm tofu','tomatoes','scallions','rice'],['Soy'],'Pan-fry tofu cubes until golden, add chopped tomatoes and simmer into a sauce. Serve with rice.'),
    R('Mac and cheese with broccoli','','American','Dinner','🧀🥦','pcv',['pasta','cheddar cheese','milk','broccoli'],['Wheat','Milk'],'Cook pasta with broccoli florets for the last 3 minutes. Stir in a sauce of melted cheese and milk.'),
    R('Egg and cheese muffin cups','','American','Breakfast','🧁🍳','pv',['eggs','cheese','spinach','bell peppers'],['Egg','Milk'],'Whisk eggs with cheese and chopped veggies, pour into a muffin tin and bake at 350°F (175°C) for 18–20 minutes. They keep 4 days in the fridge.'),
    R('Spinach and ricotta stuffed shells','conchiglioni ripieni','Italian','Dinner','🐚🧀','pcv',['jumbo pasta shells','ricotta','spinach','mozzarella','tomato sauce'],['Wheat','Milk'],'Fill cooked shells with ricotta and chopped spinach, set on tomato sauce, top with mozzarella and bake at 375°F (190°C) for 20 minutes.'),
    R('Hard-boiled eggs and grapes','','American','Snacks','🥚🍇','pv',['eggs','grapes'],['Egg'],'Boil eggs for 10 minutes, cool and peel. Pack with grapes cut in half for younger kids.'),
    R('Korean banana milk','바나나우유','Korean','Snacks','🍌🥛','pv',['bananas','milk','honey'],['Milk'],'Blend one banana with a cup of cold milk and a little honey (no honey under age 1).'),
  ];
  /* Recipes that help kids grow: what each one brings. */
  const GROWTH={'Salmon and broccoli':'Protein · vitamin D','Yogurt fruit bowl':'Calcium · protein','Eggs and toast':'Protein','Chocolate milk and fruit':'Calcium · protein',
    'Banana yogurt smoothie':'Calcium · protein','Edamame':'Protein · iron','Turkey chili':'Protein · iron','Chicken parmesan and pasta':'Protein · calcium',
    'Baked ziti with spinach':'Calcium · iron','Chicken and pea risotto':'Protein','Veggie frittata':'Protein · iron','Cottage cheese and pineapple':'Calcium · protein',
    'Breakfast burrito':'Protein · iron','Spaghetti bolognese':'Protein · iron','Pasta and bean soup':'Protein · iron','Bulgogi rice bowl':'Protein · iron',
    'Steamed egg (gyeran-jjim)':'Protein · vitamin D','Mild soft tofu soup':'Protein · calcium','Beef pho (pho bo)':'Protein · iron','Tofu in tomato sauce':'Protein · calcium',
    'Mac and cheese with broccoli':'Calcium · protein','Egg and cheese muffin cups':'Protein · calcium','Spinach and ricotta stuffed shells':'Calcium · iron',
    'Hard-boiled eggs and grapes':'Protein','Korean banana milk':'Calcium'};
  // Taekwondo tournament day meals (used by the tournament plan below)
  BUILT_IN.push(
    R('Mini pancakes and strawberries','','American','Breakfast','🥞🍓','pcv',['pancake mix','milk','eggs','strawberries','yogurt (optional)'],['Wheat','Egg','Milk'],'Make 3–4 small pancakes (about 3 inches). Serve with sliced strawberries, a spoon of yogurt if your child likes it, and a cup of water. Eat about 2–3 hours before competing.'),
    R('Applesauce or crackers','','American','Fuel before','🍎🍘','c',['applesauce pouches','crackers'],['Wheat'],'An applesauce pouch or a small handful of crackers about an hour before check-in. Easy on the stomach.'),
    R('Grilled chicken salad','','American','Lunch','🥗🍗','pcv',['grilled chicken','lettuce','cucumber','cherry tomatoes','salad dressing','bread or crackers'],['Wheat'],'Slice grilled chicken over lettuce, cucumber and tomatoes. Pack dressing on the side so the salad stays crisp, with bread or crackers.'),
    R('Applesauce or pretzels','','American','Between games','🍎🥨','c',['applesauce pouches','pretzels'],['Wheat'],'A quick, light snack between rounds: an applesauce pouch or a few pretzels, with sips of water.'),
    R('Chicken or beef, rice and vegetables','','American','Recover after','🍗🍚','pcv',['chicken or beef','rice','broccoli','carrots'],[],'After competing: grilled or pan-cooked chicken or beef with rice and steamed vegetables, plus plenty of water.'));
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
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(data));}catch{alert('Could not save on this device. Free up space and try again.');}window.littleDaysSportsSync?.queue();window.dispatchEvent(new Event('littledays:saved'));window.littleDaysReminders?.apply?.();};
  window.addEventListener('little-days-sports-remote',()=>{load();if(active)render();});

  const pref=()=>{const p=data.preferences||(data.preferences={cuisines:['Korean','Vietnamese','American','Italian'],allergies:[],servings:4});
    // Italian arrived later: turn it on once for families who already had preferences.
    if(!p.italianAdded){p.italianAdded=true;if(Array.isArray(p.cuisines)&&!p.cuisines.includes('Italian'))p.cuisines.push('Italian');}
    return p;};
  const allRecipes=()=>[...BUILT_IN,...(data.customRecipes||[]).map(normRecipe)];
  const allowed=r=>pref().cuisines.includes(r.cuisine)&&!r.allergens.some(a=>pref().allergies.includes(a));
  const recipeFor=name=>allRecipes().find(r=>r.name===name);
  const isFav=name=>data.favorites.includes(name);
  const fits=(r,slot)=>r.type===slot||(slot==='Between games'&&(r.type==='Snacks'||r.type==='Fuel before'))||(slot==='Snacks'&&r.type==='Fuel before')||(slot==='Fuel before'&&r.type==='Snacks'&&r.groups.includes('c'))||(slot==='Recover after'&&r.type==='Breakfast'&&r.groups.includes('p'));
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
  let tourPhase='before', tourDay=null;
  /* Taekwondo tournament plan: the family's own timeline + packing list (editable, synced). */
  const TKD_KINDS={meal:['🍽️','Meal'],snack:['🍎','Snack'],event:['🥋','Activity']};
  const tkdDefault=()=>({title:'Taekwondo tournament',date:'',remind:false,items:[
    {id:'t1',time:'07:00',what:'3–4 mini pancakes, strawberries, optional yogurt, water',kind:'meal',slot:'Breakfast',recipe:'Mini pancakes and strawberries'},
    {id:'t2',time:'09:15',what:'Applesauce or crackers',kind:'snack',slot:'Fuel before',recipe:'Applesauce or crackers'},
    {id:'t3',time:'10:00',what:'Check-in, sip water',kind:'event'},
    {id:'t4',time:'11:30',what:'Grilled chicken salad, dressing on the side, bread or crackers',kind:'meal',slot:'Lunch',recipe:'Grilled chicken salad'},
    {id:'t5',time:'13:30',what:'Applesauce or pretzels',kind:'snack',slot:'Between games',recipe:'Applesauce or pretzels'},
    {id:'t6',time:'14:15',what:'Warm-up, sip water',kind:'event'},
    {id:'t7',time:'15:00',what:'Poomsae',kind:'event'},
    {id:'t8',time:'15:30',end:'16:30',what:'Chicken or beef, rice, vegetables, water',kind:'meal',slot:'Recover after',recipe:'Chicken or beef, rice and vegetables'}],
    pack:['Applesauce pouches','Strawberries','Pretzels','Water bottle','Spare snack','Napkins','Insulated bag'].map((text,i)=>({id:'p'+(i+1),text,done:false}))});
  const sched=()=>{const t=data.tourSchedule;if(!t||!Array.isArray(t.items)||!Array.isArray(t.pack))data.tourSchedule=tkdDefault();return data.tourSchedule;};
  const clock=t=>{if(!/^\d{2}:\d{2}$/.test(t||''))return '';const [h,m]=t.split(':').map(Number);return new Date(2000,0,1,h,m).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});};
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
  const recipeCard=(r,extra='')=>`<button type="button" class="mp-rcard" data-recipe="${esc(r.name)}">${art(r)}<span class="mp-rname">${esc(r.name)}</span>${r.native?`<span class="mp-rnative">${esc(r.native)}</span>`:''}<span class="mp-rmeta">${esc(r.cuisine)} · ${esc(r.type)}${isFav(r.name)?' · ❤️':''}</span>${GROWTH[r.name]?`<span class="mp-rgrow">🌱 ${esc(GROWTH[r.name])}</span>`:''}${extra}</button>`;

  /* ---------- Render ---------- */
  function render(){
    if(!active)return;
    const w=weekDates(week), today=keyOf(new Date());
    if(!phoneDay||!w.includes(phoneDay))phoneDay=w.includes(today)?today:w[0];
    const TABS=[['plan','📅','Weekly plan'],['recipes','👩‍🍳','Recipes'],['grocery','🛒','Grocery list'],['favorites','❤️','Favorites'],['growth','🌱','Growing strong'],['korean','🇰🇷','Korean food'],['filters','⚙️','Filters']];
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

      </div>
      ${plan==='sports'?tkdHTML()+tourneyHTML(w,today):''}
      <div class="sm-card mp-popular"><h2>Popular Korean recipes</h2><div class="mp-strip">${korean.map(r=>recipeCard(r)).join('')}</div></div>
      <p class="sm-note">Each plan has its own week. Meal plans, recipes and grocery lists sync with your family when signed in.</p>`;
  }

  function tkdHTML(){
    const t=sched(), items=[...t.items].sort((a,b)=>(a.time||'99').localeCompare(b.time||'99')), packed=t.pack.filter(p=>p.done).length;
    const dateLabel=t.date?parse(t.date).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}):'';
    return `<div class="sm-card mp-tkd" id="mpTkd"><div class="mp-tkd-head"><h2>🥋 ${esc(t.title)}</h2><button type="button" class="mp-tkd-rename" data-tkd-rename aria-label="Rename this plan">✏️</button></div>
      <div class="mp-tkd-when"><label class="mp-tkd-date">Tournament date<input type="date" id="tkdDate" value="${esc(t.date||'')}"></label><p class="sub">${dateLabel?`📅 ${esc(dateLabel)}`:'Pick the tournament date, then add the meals to your plan.'}</p></div>
      <ol class="mp-tl">${items.map(i=>{const k=TKD_KINDS[i.kind]||TKD_KINDS.event;return `<li class="mp-tl-${esc(i.kind)}"><button type="button" data-tkd-item="${esc(i.id)}">
        <span class="mp-tl-time">${esc(clock(i.time)||'—')}${i.end?`<small>– ${esc(clock(i.end))}</small>`:''}</span><span class="mp-tl-dot" aria-hidden="true">${k[0]}</span>
        <span class="mp-tl-what">${esc(i.what)}${i.slot&&i.kind!=='event'?`<small>${SLOT_ICON[i.slot]||''} ${esc(i.slot)}</small>`:''}</span></button></li>`;}).join('')}</ol>
      <button type="button" class="mp-tkd-addstep" data-tkd-add>＋ Add a step</button>
      <div class="mp-tkd-pack"><h3>🎒 Pack <small>${packed} of ${t.pack.length} packed</small></h3>
        <div class="mp-tkd-bar" aria-hidden="true"><span style="width:${t.pack.length?Math.round(packed/t.pack.length*100):0}%"></span></div>
        ${t.pack.map(p=>`<div class="mp-tkd-packrow"><label class="sm-check"><input type="checkbox" data-tkd-pack="${esc(p.id)}" ${p.done?'checked':''}><span>${esc(p.text)}</span></label><button type="button" class="mp-tkd-x" data-tkd-unpackitem="${esc(p.id)}" aria-label="Remove ${esc(p.text)}">✕</button></div>`).join('')}
        <div class="mp-own"><input type="text" id="tkdPackNew" maxlength="60" placeholder="Add something to pack…" aria-label="Add something to pack"><button type="button" class="btn" data-tkd-packadd>Add</button></div>
        ${packed?'<button type="button" class="link-btn" data-tkd-unpack>Start over (uncheck all)</button>':''}</div>
      <div class="mp-tkd-actions">
        <button type="button" class="btn primary" data-tkd-plan>🍽️ Add meals to plan</button>
        <label class="switch mp-tkd-remind"><input type="checkbox" data-tkd-remind ${t.remind?'checked':''}><span>🔔 Remind me at each step</span></label></div>
      <p class="sub">${t.remind?`Reminders come ${esc(String(window.littleDaysReminders?.prefs?.().minutes??10))} minutes before each step, plus a packing reminder the evening before (change timing in Settings → Reminders).`:'Turn on reminders to get a heads-up before each step and a packing reminder the night before.'}</p></div>`;
  }
  function tkdEdit(itemId){
    const t=sched(), it=itemId?t.items.find(x=>x.id===itemId):{time:'',what:'',kind:'meal',slot:'Lunch'};
    if(!it)return;
    const slots=PLANS.sports.slots;
    const s=sheet(`<div class="mp-sheet-head"><h2>${itemId?'Edit step':'Add a step'}</h2><button type="button" class="mp-x" data-close aria-label="Close">✕</button></div>
      <form class="sm-form" id="tkdForm"><div class="sm-row"><label>Time<input type="time" name="time" value="${esc(it.time||'')}" required></label><label>Until <small>(optional)</small><input type="time" name="end" value="${esc(it.end||'')}"></label></div>
      <label>What<input name="what" maxlength="120" value="${esc(it.what)}" required></label>
      <div class="sm-row"><label>Type<select name="kind">${Object.entries(TKD_KINDS).map(([k,[i,l]])=>`<option value="${k}"${it.kind===k?' selected':''}>${i} ${l}</option>`).join('')}</select></label>
      <label>In the meal plan as<select name="slot">${slots.map(x=>`<option${it.slot===x?' selected':''}>${esc(x)}</option>`).join('')}</select></label></div>
      <div class="sm-actions"><button class="btn primary" type="submit">Save</button>${itemId?'<button class="btn" type="button" id="tkdDel">Delete step</button>':''}</div></form>`);
    s.querySelector('#tkdForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);
      const next={...it,time:String(f.get('time')||''),end:String(f.get('end')||''),what:String(f.get('what')||'').trim(),kind:String(f.get('kind')),slot:String(f.get('slot'))};
      if(!next.what||!next.time)return; if(!next.end)delete next.end;
      if(itemId){if(next.what!==it.what)delete next.recipe;t.items=t.items.map(x=>x.id===itemId?next:x);}else t.items.push({...next,id:id()});
      save();closeSheet();render();};
    s.querySelector('#tkdDel')?.addEventListener('click',()=>{t.items=t.items.filter(x=>x.id!==itemId);save();closeSheet();render();});
  }
  function tkdAddMeals(){
    const t=sched();
    if(!t.date){alert('Pick the tournament date first.');panel.querySelector('#tkdDate')?.focus();return;}
    let n=0;
    for(const it of t.items){
      if(it.kind==='event'||!it.slot)continue;
      const name=(it.recipe&&recipeFor(it.recipe))?it.recipe:it.what;
      if(mealsAt('sports',t.date,it.slot).some(m=>m.name===name))continue;
      data.planMeals.push({id:id(),plan:'sports',date:t.date,slot:it.slot,name}); n++;
    }
    save(); plan='sports'; localStorage.setItem('ld_meal_plan_kind',plan);
    week=Math.round((monday(parse(t.date))-monday(new Date()))/(7*864e5)); phoneDay=t.date; render();
    window.scrollTo({top:0,behavior:'smooth'});
    toastMsg(n?`Added ${n} tournament meals to ${parse(t.date).toLocaleDateString(undefined,{weekday:'long'})}`:'Those meals are already in the plan');
  }

  function tourneyHTML(w,today){
    const g=TOURNEY[tourPhase];
    if(!tourDay||!w.includes(tourDay))tourDay=w.includes(today)?(w.find(d=>d>=today&&parse(d).getDay()===6)||today):w[5];
    const chip=f=>{const r=recipeFor(f);return r?`<button type="button" class="mp-tchip${allowed(r)?'':' off'}" data-recipe="${esc(f)}">${esc(r.art.slice(0,2))} ${esc(f)}</button>`:`<span class="mp-tchip plain">${esc(f)}</span>`;};
    return `<div class="sm-card mp-tourney"><div class="mp-thead"><h2>🏆 Tournament day guide</h2><p class="sub">Timing, what to eat and what to avoid.</p></div>
      <div class="mp-tphases" role="group" aria-label="When">${Object.entries(TOURNEY).map(([k,p])=>`<button type="button" data-tphase="${k}" aria-pressed="${tourPhase===k}" class="${tourPhase===k?'chosen':''}"><span aria-hidden="true">${p.icon}</span> ${p.label}</button>`).join('')}</div>
      <div class="mp-tcols"><ol class="mp-trows">${g.rows.map(r=>`<li><span class="mp-twhen">${esc(r.when)}</span><p>${esc(r.what)}</p><div class="mp-tchips">${r.foods.map(chip).join('')}</div></li>`).join('')}</ol>
        <div class="mp-tavoid"><h3>🚫 Avoid</h3><ul>${g.avoid.map(a=>`<li>${esc(a)}</li>`).join('')}</ul></div></div>
      <div class="mp-tplan"><label for="mpTourDay">Plan a tournament day</label><select id="mpTourDay">${w.map(d=>`<option value="${d}"${d===tourDay?' selected':''}>${esc(parse(d).toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'}))}</option>`).join('')}</select>
        <button type="button" class="btn primary" data-tplan>Fill this day</button></div>
      <p class="sub">General tips for active kids, not medical or nutrition advice. Ask your doctor about allergies or special needs.</p></div>`;
  }
  /* Fill a day's empty Sports slots from the guide, respecting cuisines and allergies. */
  function planTournamentDay(date){
    const pool=allRecipes().filter(allowed); let n=0;
    for(const p of Object.values(TOURNEY))for(const row of p.rows){
      if(!row.slot||mealsAt('sports',date,row.slot).length)continue;
      const pick=row.foods.map(recipeFor).find(r=>r&&allowed(r))||pool.find(r=>fits(r,row.slot));
      if(!pick)continue;
      data.planMeals.push({id:id(),plan:'sports',date,slot:row.slot,name:pick.name}); n++;
    }
    return n;
  }

  function recipesHTML(kind){
    let list=allRecipes().filter(allowed);
    if(kind==='favorites')list=allRecipes().filter(r=>isFav(r.name));
    if(kind==='korean')list=allRecipes().filter(r=>r.cuisine==='Korean'&&allowed(r));
    if(kind==='growth')list=list.filter(r=>GROWTH[r.name]);
    const q=search.trim().toLowerCase();
    if(q)list=list.filter(r=>(r.name+' '+(r.native||'')+' '+r.ingredients.join(' ')).toLowerCase().includes(q));
    const order=['Breakfast','Lunch','Dinner','Fuel before','Between games','Recover after','Snacks'];
    const groups=order.map(t=>[t,list.filter(r=>r.type===t)]).filter(([,l])=>l.length);
    const empty=kind==='favorites'?'<p class="sub">Tap ❤️ on any recipe to save it here.</p>':'<p class="sub">No recipes match. Try another search or check Filters.</p>';
    const growthTips=kind==='growth'?`<div class="sm-card mp-growth"><h2>🌱 Growing strong</h2><ul>
        <li><b>Protein at every meal</b>: eggs, fish, chicken, beef, tofu, beans, milk and yogurt build muscle.</li>
        <li><b>Calcium and vitamin D</b>: milk, yogurt, cheese, tofu and salmon help bones grow. Playing outside in daylight helps too.</li>
        <li><b>Iron</b>: beef, beans, spinach and eggs carry energy around the body. Pair them with fruit for vitamin C.</li>
        <li><b>Colors on the plate</b>: fruits and vegetables of different colors every day.</li>
        <li><b>Sleep</b>: most growing happens during sleep. Kids 6–12 need about 9–12 hours.</li></ul>
        <p class="sub">General tips, not medical advice. Ask your child's doctor about their growth or any special diet.</p></div>`:'';
    return `${growthTips}<div class="mp-searchrow"><input type="search" id="mpSearch" placeholder="Search recipes or ingredients" value="${esc(search)}" aria-label="Search recipes">
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
    return `<div class="sm-card"><h2>Cuisines</h2>${['Korean','Vietnamese','American','Italian'].map(c=>`<label class="sm-check"><input type="checkbox" data-cuisine="${c}" ${pref().cuisines.includes(c)?'checked':''}>${c}</label>`).join('')}
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
      <label>Best for<select name="type">${['Breakfast','Lunch','Dinner','Snacks','Fuel before','Between games','Recover after'].map(x=>`<option>${x}</option>`).join('')}</select></label></div>
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
    if(k==='tournament'){plan='sports';tourPhase='before';localStorage.setItem('ld_meal_plan_kind',plan);render();panel.querySelector('#mpTkd')?.scrollIntoView({behavior:'smooth',block:'start'});toastMsg('Here is your tournament day plan');return;}
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
    qa('[data-tkd-item]').forEach(b=>b.onclick=()=>tkdEdit(b.dataset.tkdItem));
    panel.querySelector('[data-tkd-add]')?.addEventListener('click',()=>tkdEdit(null));
    panel.querySelector('[data-tkd-rename]')?.addEventListener('click',()=>{const t=sched();const v=(prompt('Name this plan:',t.title)||'').trim().slice(0,60);if(v){t.title=v;save();render();}});
    qa('[data-tkd-pack]').forEach(b=>b.onchange=()=>{const p=sched().pack.find(x=>x.id===b.dataset.tkdPack);if(p){p.done=b.checked;save();render();}});
    qa('[data-tkd-unpackitem]').forEach(b=>b.onclick=()=>{const t=sched();t.pack=t.pack.filter(x=>x.id!==b.dataset.tkdUnpackitem);save();render();});
    const pn=panel.querySelector('#tkdPackNew'), packAdd=()=>{const v=(pn?.value||'').trim();if(!v)return;sched().pack.push({id:id(),text:v.slice(0,60),done:false});save();render();panel.querySelector('#tkdPackNew')?.focus();};
    panel.querySelector('[data-tkd-packadd]')?.addEventListener('click',packAdd); if(pn)pn.onkeydown=e=>{if(e.key==='Enter')packAdd();};
    panel.querySelector('[data-tkd-unpack]')?.addEventListener('click',()=>{sched().pack.forEach(p=>p.done=false);save();render();});
    const tdate=panel.querySelector('#tkdDate'); if(tdate)tdate.onchange=()=>{sched().date=tdate.value;save();render();};
    panel.querySelector('[data-tkd-plan]')?.addEventListener('click',tkdAddMeals);
    panel.querySelector('[data-tkd-remind]')?.addEventListener('change',async e=>{
      const t=sched(); t.remind=e.target.checked; save(); render();
      if(!t.remind)return;
      if(!t.date)toastMsg('Pick the tournament date so reminders know when to come');
      const R=window.littleDaysReminders, st=R?.status?.();
      if(st==='prompt'){await R.ask();}
      else if(st&&st!=='granted')alert('Reminders are off on this device. Turn them on in Settings → Reminders.');
      else if(R&&!R.enabled())alert('Reminders are switched off in Settings → Reminders. Turn them on to get these.');
    });
    qa('[data-tphase]').forEach(b=>b.onclick=()=>{tourPhase=b.dataset.tphase;render();});
    const td=panel.querySelector('#mpTourDay'); if(td)td.onchange=()=>{tourDay=td.value;};
    panel.querySelector('[data-tplan]')?.addEventListener('click',()=>{const d=td?.value||tourDay;tourDay=d;
      if(!Array.isArray(data.planMeals))data.planMeals=[];
      const n=planTournamentDay(d);save();phoneDay=d;render();
      toastMsg(n?`Planned ${n} tournament meals for ${parse(d).toLocaleDateString(undefined,{weekday:'long'})}`:'That day is already planned');});
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
