/* Little Days meal plan sync: three-way merge for the shared Meal Plan document.
   base = the last version this device saw from the server, local = this device
   now, remote = the server now. Changes made on this device since base are
   applied on top of remote, so two parents editing at once both keep their work.
   Lists merge item by item (meals by id, recipes by name); settings-like maps
   merge key by key; anything else keeps this device's version only if it
   changed here.                                                                 */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.LittleDaysMealsSync = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const KEYED = { planMeals: 'id', meals: 'id', events: 'id', customRecipes: 'name' };
  const SETS = ['favorites'];
  const MAPS = ['groceryChecked', 'dayTypes', 'checklist'];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const arr = v => (Array.isArray(v) ? v : []);

  function mergeList(base, local, remote, key) {
    const k = x => (x && typeof x === 'object' ? String(x[key] ?? '') : '');
    const b = new Map(arr(base).map(x => [k(x), x])), l = new Map(arr(local).map(x => [k(x), x]));
    const out = new Map(arr(remote).map(x => [k(x), x]));
    for (const [id, item] of l) {
      if (!id) continue;
      if (!b.has(id) || !same(b.get(id), item)) out.set(id, item);   // added or edited here
    }
    for (const id of b.keys()) if (!l.has(id)) out.delete(id);      // deleted here
    return [...out.values()];
  }
  function mergeSet(base, local, remote) {
    const b = new Set(arr(base)), l = new Set(arr(local)), out = new Set(arr(remote));
    for (const x of l) if (!b.has(x)) out.add(x);
    for (const x of b) if (!l.has(x)) out.delete(x);
    return [...out];
  }
  function mergeMap(base, local, remote) {
    const b = obj(base), l = obj(local), out = { ...obj(remote) };
    for (const key of new Set([...Object.keys(b), ...Object.keys(l)])) {
      if (same(b[key], l[key])) continue;
      if (l[key] === undefined) delete out[key]; else out[key] = l[key];
    }
    return out;
  }
  /* base may be null (first sync after updating): then nothing counts as deleted. */
  function merge(base, local, remote) {
    const B = obj(base), L = obj(local), Rm = obj(remote);
    const out = { ...Rm };
    for (const key of new Set([...Object.keys(L), ...Object.keys(Rm)])) {
      if (KEYED[key]) out[key] = mergeList(base ? B[key] : [], L[key], Rm[key], KEYED[key]);
      else if (SETS.includes(key)) out[key] = mergeSet(base ? B[key] : [], L[key], Rm[key]);
      else if (MAPS.includes(key)) out[key] = mergeMap(base ? B[key] : {}, L[key], Rm[key]);
      else if (!(key in Rm) || (base && !same(B[key], L[key])) || (!base && key in L && !(key in Rm))) { if (key in L) out[key] = L[key]; }
    }
    return out;
  }
  return { merge, mergeList, mergeSet, mergeMap };
});
