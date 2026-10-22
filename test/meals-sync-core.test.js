const test = require('node:test');
const assert = require('node:assert/strict');
const { merge } = require('../meals-sync-core.js');

const meal = (id, name, date = '2026-10-22', slot = 'Dinner', plan = 'regular') => ({ id, plan, date, slot, name });
const base = () => ({ planMeals: [meal('a', 'Pho ga'), meal('b', 'Kimbap', '2026-10-23', 'Lunch')], favorites: ['Japchae'],
  groceryChecked: { rice: true }, preferences: { cuisines: ['Korean'], allergies: [] }, customRecipes: [{ name: 'Soup', type: 'Dinner' }] });

test('two parents adding meals at the same time keep both', () => {
  const b = base();
  const mine = { ...b, planMeals: [...b.planMeals, meal('m1', 'Bibimbap', '2026-10-24')] };
  const theirs = { ...b, planMeals: [...b.planMeals, meal('t1', 'Banh mi', '2026-10-24', 'Lunch')] };
  const out = merge(b, mine, theirs);
  assert.deepEqual(out.planMeals.map(m => m.id).sort(), ['a', 'b', 'm1', 't1']);
});

test('a meal deleted here stays deleted; a meal deleted there is not brought back', () => {
  const b = base();
  const mine = { ...b, planMeals: [b.planMeals[1]] };            // I removed Pho ga
  const theirs = { ...b, planMeals: [b.planMeals[0]] };          // they removed Kimbap
  assert.deepEqual(merge(b, mine, theirs).planMeals, []);
});

test('edits here win for the same meal; other fields merge', () => {
  const b = base();
  const mine = { ...b, planMeals: [{ ...b.planMeals[0], name: 'Pho bo' }, b.planMeals[1]], groceryChecked: { rice: true, eggs: true } };
  const theirs = { ...b, favorites: ['Japchae', 'Kimbap'], groceryChecked: { rice: false } };
  const out = merge(b, mine, theirs);
  assert.equal(out.planMeals.find(m => m.id === 'a').name, 'Pho bo');
  assert.deepEqual(out.favorites.sort(), ['Japchae', 'Kimbap']);
  assert.deepEqual(out.groceryChecked, { rice: false, eggs: true }, 'their uncheck of rice kept, my eggs check added');
});

test('favorites and recipes: removals and additions from both sides', () => {
  const b = base();
  const mine = { ...b, favorites: [], customRecipes: [...b.customRecipes, { name: 'Stew', type: 'Dinner' }] };
  const theirs = { ...b, favorites: ['Japchae', 'Pho ga'], customRecipes: [] };
  const out = merge(b, mine, theirs);
  assert.deepEqual(out.favorites, ['Pho ga']);
  assert.deepEqual(out.customRecipes.map(r => r.name), ['Stew']);
});

test('preferences: this device wins only if it changed them', () => {
  const b = base();
  const theirs = { ...b, preferences: { cuisines: ['Korean', 'Vietnamese'], allergies: [] } };
  assert.deepEqual(merge(b, b, theirs).preferences.cuisines, ['Korean', 'Vietnamese']);
  const mine = { ...b, preferences: { cuisines: [], allergies: ['Egg'] } };
  assert.deepEqual(merge(b, mine, theirs).preferences.allergies, ['Egg']);
});

test('no base yet (first sync after update): nothing is deleted, everything is combined', () => {
  const mine = { planMeals: [meal('m1', 'Bibimbap')], favorites: ['A'] };
  const theirs = { planMeals: [meal('t1', 'Pho ga')], favorites: ['B'] };
  const out = merge(null, mine, theirs);
  assert.deepEqual(out.planMeals.map(m => m.id).sort(), ['m1', 't1']);
  assert.deepEqual(out.favorites.sort(), ['A', 'B']);
});
