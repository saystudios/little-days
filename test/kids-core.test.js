const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../kids-core.js');

const fresh = () => K.ensure({
  kids: [{ id: 'y', name: 'Yuna' }, { id: 'l', name: 'Leo' }], events: [], tasks: [],
  chores: [
    { id: 'bed', title: 'Make bed', kidId: 'y', days: [], stars: 1 },
    { id: 'room', title: 'Clean room', kidId: 'y', days: [6], stars: 3, approval: true },   // Saturdays, needs a grown-up
    { id: 'dog', title: 'Feed dog', kidId: 'l', days: [1, 3, 5], stars: 2 }
  ],
  routines: [{ id: 'am', kidId: 'y', name: 'Morning', stars: 2, steps: [{ id: 's1', title: 'Teeth' }, { id: 's2', title: 'Dress' }] }],
  rewards: [{ id: 'park', title: 'Park trip', cost: 4 }]
});

test('older planners get empty kids fields without losing anything', () => {
  const d = K.ensure({ kids: [{ id: 'a' }], events: [{ id: 'e' }], tasks: [] });
  assert.deepEqual(d.chores, []); assert.deepEqual(d.log, {}); assert.equal(d.settings.stars, true);
  assert.equal(d.events.length, 1);
});

test('chores are due on their days only', () => {
  const d = fresh();
  assert.deepEqual(K.choresFor(d, 'y', '2026-10-20').map(c => c.id), ['bed']);          // Tuesday
  assert.deepEqual(K.choresFor(d, 'y', '2026-10-24').map(c => c.id), ['bed', 'room']);  // Saturday
  assert.deepEqual(K.choresFor(d, 'l', '2026-10-21').map(c => c.id), ['dog']);          // Wednesday
});

test('ticking a chore earns stars; unticking takes them back', () => {
  const d = fresh();
  assert.equal(K.toggleChore(d, d.chores[0], '2026-10-20'), 'done');
  assert.equal(K.balance(d, 'y'), 1);
  assert.equal(K.toggleChore(d, d.chores[0], '2026-10-20'), 'todo');
  assert.equal(K.balance(d, 'y'), 0);
});

test('approval chores wait for a grown-up before stars count', () => {
  const d = fresh(), room = d.chores[1];
  assert.equal(K.toggleChore(d, room, '2026-10-24'), 'waiting');
  assert.equal(K.balance(d, 'y'), 0);
  assert.equal(K.pending(d).length, 1);
  K.approveChore(d, room, '2026-10-24');
  assert.equal(K.choreStatus(d, room, '2026-10-24'), 'done');
  assert.equal(K.balance(d, 'y'), 3);
  assert.equal(K.pending(d).length, 0);
  // A parent ticking it counts straight away.
  assert.equal(K.toggleChore(d, room, '2026-10-31', { byParent: true }), 'done');
});

test('stars use the value when earned, even if the chore changes later', () => {
  const d = fresh();
  K.toggleChore(d, d.chores[0], '2026-10-20');
  d.chores[0].stars = 10;
  assert.equal(K.balance(d, 'y'), 1);
});

test('routines earn stars only when every step is done', () => {
  const d = fresh(), r = d.routines[0];
  assert.equal(K.toggleStep(d, r, 's1', '2026-10-20'), false);
  assert.equal(K.balance(d, 'y'), 0);
  assert.equal(K.toggleStep(d, r, 's2', '2026-10-20'), true);
  assert.equal(K.routineDone(d, r, '2026-10-20'), true);
  assert.equal(K.balance(d, 'y'), 2);
  K.toggleStep(d, r, 's2', '2026-10-20');            // untick one step
  assert.equal(K.balance(d, 'y'), 0);
  assert.equal(K.pending(d).length, 0, 'routines never wait for approval');
});

test('rewards: ask, give, decline and no overspending', () => {
  const d = fresh();
  ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'].forEach(day => K.toggleChore(d, d.chores[0], day));
  assert.equal(K.balance(d, 'y'), 5);
  const r1 = K.askReward(d, 'y', d.rewards[0], { id: 'a' });
  assert.ok(r1);
  assert.equal(K.available(d, 'y'), 1, 'stars are set aside while waiting');
  assert.equal(K.askReward(d, 'y', d.rewards[0], { id: 'b' }), null, 'cannot ask for more than you have');
  assert.equal(K.decide(d, 'a', true), true);
  assert.equal(K.balance(d, 'y'), 1);
  assert.equal(K.decide(d, 'a', true), false, 'cannot give twice');
  ['2026-10-26', '2026-10-27', '2026-10-28'].forEach(day => K.toggleChore(d, d.chores[0], day));
  const r2 = K.askReward(d, 'y', d.rewards[0], { id: 'c' });
  K.decide(d, r2.id, false);
  assert.equal(K.balance(d, 'y'), 4, 'declined requests cost nothing');
});

test("each child's stars are their own", () => {
  const d = fresh();
  K.toggleChore(d, d.chores[2], '2026-10-21');
  assert.equal(K.balance(d, 'l'), 2);
  assert.equal(K.balance(d, 'y'), 0);
});

test('streaks count full days and skip days with nothing due', () => {
  const d = fresh(), dog = d.chores[2];           // Mon, Wed, Fri
  ['2026-10-12', '2026-10-14', '2026-10-16', '2026-10-19'].forEach(day => K.toggleChore(d, dog, day));
  assert.equal(K.streak(d, 'l', '2026-10-20'), 4, 'Tuesday has nothing due, streak continues');
  assert.equal(K.streak(d, 'l', '2026-10-21'), 4, 'today not done yet still shows the streak so far');
  K.toggleChore(d, dog, '2026-10-21');
  assert.equal(K.streak(d, 'l', '2026-10-21'), 5);
  assert.equal(K.streak(d, 'l', '2026-10-24'), 0, 'missing Friday breaks it');
});

test('weekly progress', () => {
  const d = fresh();
  K.toggleChore(d, d.chores[0], '2026-10-18');
  K.toggleChore(d, d.chores[0], '2026-10-19');
  const w = K.weekProgress(d, 'y', '2026-10-20');
  assert.equal(w.due, 8);       // bed x7 + room on Saturday
  assert.equal(w.done, 2);
  assert.equal(w.stars, 2);
});

test('tidy folds old days into the star bank without changing balances', () => {
  const d = fresh();
  K.toggleChore(d, d.chores[0], '2026-01-05');
  K.toggleChore(d, d.chores[0], '2026-10-20');
  K.askReward(d, 'y', { id: 'x', cost: 1 }, { id: 'old', now: new Date('2026-01-06T12:00:00Z') });
  K.decide(d, 'old', true);
  const before = K.balance(d, 'y');
  K.tidy(d, '2026-10-20');
  assert.equal(d.log['2026-01-05'], undefined);
  assert.equal(d.starBank.y, 1);
  assert.equal(K.balance(d, 'y'), before);
});

test('age and chore ideas', () => {
  assert.equal(K.ageOn('2019-11-02', '2026-10-20'), 6);
  assert.equal(K.ageOn('2019-11-02', '2026-11-02'), 7);
  assert.ok(K.ideasFor(4).every(i => i.min <= 4));
  assert.ok(K.ideasFor(12).length > K.ideasFor(5).length);
  assert.equal(K.ideasFor(null).length, K.IDEAS.length);
});
