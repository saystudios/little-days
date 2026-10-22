const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../kids-core.js');
const C = require('../climb-core.js');
const S = require('../sync-core.js');

const fresh = () => K.ensure({
  kids: [{ id: 'y', name: 'Yuna' }, { id: 'l', name: 'Leo' }], events: [], tasks: [],
  chores: [
    { id: 'bed', title: 'Make bed', kidId: 'y', days: [], stars: 1 },
    { id: 'room', title: 'Clean room', kidId: 'y', days: [], stars: 3, approval: true },
    { id: 'dog', title: 'Feed dog', kidId: 'l', days: [], stars: 2 }
  ],
  routines: [{ id: 'am', kidId: 'y', name: 'Morning', stars: 2, steps: [{ id: 's1', title: 'Teeth' }, { id: 's2', title: 'Dress' }] }],
  rewards: []
});
const yuna = d => d.kids[0];

test('approved chores, routine steps and visualization climb meters', () => {
  const d = fresh(), day = '2026-10-21';
  K.toggleChore(d, d.chores[0], day);                 // +50
  K.toggleStep(d, d.routines[0], 's1', day);          // +20 (routine not finished yet)
  assert.equal(C.metersOn(d, 'y', day), 70);
  K.toggleStep(d, d.routines[0], 's2', day);          // finished: 2 steps
  assert.equal(C.metersOn(d, 'y', day), 90);
  assert.ok(C.finishViz(d, yuna(d), day));
  assert.equal(C.metersOn(d, 'y', day), 140);
  assert.equal(C.metersOn(d, 'l', day), 0);
});

test('chores waiting for a grown-up count only once approved', () => {
  const d = fresh(), day = '2026-10-21', room = d.chores[1];
  K.toggleChore(d, room, day);
  assert.equal(C.metersOn(d, 'y', day), 0);
  K.approveChore(d, room, day);
  assert.equal(C.metersOn(d, 'y', day), 50);
});

test('visualization counts once a day and never adds stars or grown-up requests', () => {
  const d = fresh(), day = '2026-10-21';
  assert.ok(C.finishViz(d, yuna(d), day));
  assert.equal(C.finishViz(d, yuna(d), day), false);
  assert.equal(yuna(d).climb.viz, 1);
  assert.equal(K.balance(d, 'y'), 0);
  assert.equal(K.pending(d).length, 0);
  assert.deepEqual(K.dayProgress(d, 'y', day), { due: 2, done: 0 });
});

test('position splits meters into summits', () => {
  assert.deepEqual(C.position(0), { summits: 0, mountain: 1, into: 0, left: 3000, fraction: 0 });
  const p = C.position(7250);
  assert.equal(p.summits, 2); assert.equal(p.mountain, 3); assert.equal(p.into, 1250); assert.equal(p.left, 1750);
});

test('streak counts days in a row with any climbing', () => {
  const d = fresh();
  for (const day of ['2026-10-18', '2026-10-19', '2026-10-20']) K.toggleChore(d, d.chores[0], day);
  assert.equal(C.streak(d, 'y', '2026-10-21'), 3);       // today not started yet
  C.finishViz(d, yuna(d), '2026-10-21');
  assert.equal(C.streak(d, 'y', '2026-10-21'), 4);
  assert.equal(C.streak(d, 'l', '2026-10-21'), 0);
});

test('old days are banked before tidy removes them, and only once', () => {
  const d = fresh();
  K.toggleChore(d, d.chores[0], '2026-01-05');
  K.toggleChore(d, d.chores[0], '2026-10-20');
  const before = C.total(d, yuna(d));
  assert.equal(before, 100);
  C.fold(d, '2026-10-21'); K.tidy(d, '2026-10-21');
  assert.equal(d.log['2026-01-05'], undefined);
  assert.equal(yuna(d).climb.bank, 50);
  assert.equal(C.total(d, yuna(d)), before);
  C.fold(d, '2026-10-21');                                // a second device folding again
  assert.equal(C.total(d, yuna(d)), before);
});

test('a dream keeps step progress when edited, and empty dreams are removed', () => {
  const k = { id: 'y' }; let n = 0; const id = () => 'n' + n++;
  C.setDream(k, { text: 'Win my ski race', steps: [{ title: 'Practice turns' }, { title: '  ' }] }, id);
  assert.equal(k.dream.steps.length, 1);
  assert.equal(C.toggleDreamStep(k, 'n0'), true);
  C.setDream(k, { text: 'Win my ski race', steps: [{ id: 'n0', title: 'Practice turns 3x a week' }, { title: 'Read every night' }] }, id);
  assert.equal(k.dream.steps[0].done, true);
  assert.equal(k.dream.steps[1].done, false);
  C.setDream(k, { text: '', steps: [] }, id);
  assert.equal(k.dream, undefined);
});

test('lessons need both parts and keep the newest ten', () => {
  const k = { id: 'y' };
  assert.equal(C.addLesson(k, 'Fell', '', '2026-10-21', 'a'), null);
  for (let i = 0; i < 12; i++) C.addLesson(k, 'Oops ' + i, 'Learned ' + i, '2026-10-21', 'l' + i);
  assert.equal(k.lessons.length, 10);
  assert.equal(k.lessons[9].oops, 'Oops 11');
});

test('medals are awarded once and kept', () => {
  const d = fresh(), k = yuna(d);
  assert.deepEqual(C.awardMedals(d, k, '2026-10-21'), []);
  K.toggleChore(d, d.chores[0], '2026-10-21');
  assert.deepEqual(C.awardMedals(d, k, '2026-10-21').map(m => m.id), ['first']);
  assert.deepEqual(C.awardMedals(d, k, '2026-10-21'), []);
  K.toggleChore(d, d.chores[0], '2026-10-21');           // unticked: medal stays
  assert.ok(C.hasMedal(k, 'first'));
});

test('climb data syncs as existing item kinds', () => {
  const d = fresh(), day = '2026-10-21';
  C.finishViz(d, yuna(d), day);
  C.setDream(yuna(d), { text: 'Win my race', steps: [{ title: 'Practice' }] }, () => 'x');
  const back = S.fromItems([...S.flatten(d)].map(([key, data]) => { const [kind, id] = S.splitKey(key); return { kind, id, data }; }));
  assert.equal(C.metersOn(back, 'y', day), 50);
  assert.equal(back.kids[0].dream.text, 'Win my race');
});
