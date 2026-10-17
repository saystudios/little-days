const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../sync-core.js');

const planner = () => ({
  kids: [{ id: 'y', name: 'Yuna', color: 0 }, { id: 'l', name: 'Leo', color: 1 }],
  events: [{ id: 'e1', title: 'Piano', date: '2026-10-20', repeat: 'weekly', days: [1, 3], skip: ['2026-10-26'] }],
  tasks: [{ id: 't1', title: 'Sign form', done: false }],
  chores: [{ id: 'c1', title: 'Make bed', kidId: 'y', days: [], stars: 1 }],
  routines: [{ id: 'r1', kidId: 'y', name: 'Morning', steps: [{ id: 's1', title: 'Teeth' }], stars: 2 }],
  rewards: [{ id: 'w1', title: 'Park', cost: 5 }],
  lists: [{ id: 'g', title: 'Groceries', emoji: '🛒' }],
  listItems: [{ id: 'i1', listId: 'g', text: 'Milk', done: false }],
  redemptions: [{ id: 'q1', kidId: 'y', rewardId: 'w1', cost: 5, status: 'asked' }],
  log: { '2026-10-20': { c1: { kidId: 'y', stars: 1, ok: true }, r1: { kidId: 'y', steps: ['s1'], stars: 2, ok: true } } },
  starBank: { y: 4 },
  settings: { stars: true }
});

test('flatten gives one item per thing, with stable keys', () => {
  const keys = [...S.flatten(planner()).keys()].sort();
  assert.deepEqual(keys, ['bank:y', 'chore:c1', 'event:e1', 'kid:l', 'kid:y', 'list:g', 'listitem:i1', 'log:2026-10-20|c1', 'log:2026-10-20|r1',
    'redemption:q1', 'reward:w1', 'routine:r1', 'setting:settings', 'task:t1']);
});

test('fromItems(flatten(p)) round-trips the planner', () => {
  const p = planner();
  const rows = [...S.flatten(p)].map(([k, data]) => { const [kind, id] = S.splitKey(k); return { kind, id, data }; });
  const back = S.fromItems(rows);
  assert.equal(S.stable(back), S.stable(p));
});

test('stable text ignores key order', () => {
  assert.equal(S.stable({ b: 1, a: [1, { d: 2, c: 3 }] }), S.stable({ a: [1, { c: 3, d: 2 }], b: 1 }));
});

test('diff finds edits, additions and deletions only', () => {
  const p = planner(), base = S.fingerprint(p);
  assert.deepEqual(S.diff(p, base), []);
  p.tasks[0].done = true;                                   // edit
  p.events.push({ id: 'e2', title: 'Dentist', date: '2026-10-22' });   // add
  p.kids = p.kids.filter(k => k.id !== 'l');                // delete
  delete p.log['2026-10-20'].c1;                            // untick
  const changes = S.diff(p, base).map(c => `${c.kind}:${c.id}:${c.deleted ? 'del' : 'put'}`).sort();
  assert.deepEqual(changes, ['event:e2:put', 'kid:l:del', 'log:2026-10-20|c1:del', 'task:t1:put']);
});

test('applyItem updates, inserts and removes each kind', () => {
  const p = planner();
  S.applyItem(p, { kind: 'task', id: 't1', data: { id: 't1', title: 'Sign form', done: true } });
  S.applyItem(p, { kind: 'chore', id: 'c2', data: { id: 'c2', title: 'Feed dog', kidId: 'l' } });
  S.applyItem(p, { kind: 'kid', id: 'l', deleted: true });
  S.applyItem(p, { kind: 'log', id: '2026-10-21|c2', data: { kidId: 'l', stars: 1, ok: true } });
  S.applyItem(p, { kind: 'log', id: '2026-10-20|c1', deleted: true });
  S.applyItem(p, { kind: 'log', id: '2026-10-20|r1', deleted: true });
  S.applyItem(p, { kind: 'bank', id: 'l', data: { stars: 7 } });
  S.applyItem(p, { kind: 'setting', id: 'settings', data: { stars: false } });
  assert.equal(p.tasks[0].done, true);
  assert.equal(p.chores.length, 2);
  assert.deepEqual(p.kids.map(k => k.id), ['y']);
  assert.equal(p.log['2026-10-21'].c2.ok, true);
  assert.equal(p.log['2026-10-20'], undefined, 'empty days are removed');
  assert.equal(p.starBank.l, 7);
  assert.equal(p.settings.stars, false);
});

test('two devices changing different items both survive', () => {
  const server = planner(), a = planner(), b = planner();
  const baseA = S.fingerprint(a), baseB = S.fingerprint(b);
  a.log['2026-10-21'] = { c1: { kidId: 'y', stars: 1, ok: true } };          // Yuna ticks on iPad A
  b.tasks.push({ id: 't2', title: 'Buy milk' });                              // parent adds on phone B
  for (const c of [...S.diff(a, baseA), ...S.diff(b, baseB)]) S.applyItem(server, c);
  assert.ok(server.log['2026-10-21'].c1);
  assert.equal(server.tasks.length, 2);
});

test('outbox keeps only the newest change per item', () => {
  let box = S.mergeOutbox([], [{ kind: 'task', id: 't1', data: { done: false } }]);
  box = S.mergeOutbox(box, [{ kind: 'task', id: 't1', data: { done: true } }, { kind: 'kid', id: 'y', data: {} }]);
  assert.equal(box.length, 2);
  assert.equal(box.find(c => c.id === 't1').data.done, true);
});

test('ids with colons or pipes still split correctly', () => {
  assert.deepEqual(S.splitKey('event:abc:def'), ['event', 'abc:def']);
  const p = { kids: [], events: [], tasks: [] };
  S.applyItem(p, { kind: 'log', id: '2026-10-20|x|y', data: { ok: true } });
  assert.ok(p.log['2026-10-20']['x|y']);
});
