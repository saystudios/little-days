const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../scan-core.js');

const kids = [{ id: 'y', name: 'Yuna' }, { id: 'l', name: 'Leo Park' }, { id: 'm', name: 'Mia' }];
const ev = o => ({ title: 'Soccer practice', date: '2026-10-23', time: '18:00', endTime: '19:30', location: 'Rec Center', who: '', category: 'Sports', notes: '', repeatWeekdays: [], until: '', ...o });

test('a clean event becomes an activity draft', () => {
  const [d] = S.toDrafts([ev({ who: 'Yuna', notes: 'Bring shin guards' })], kids);
  assert.deepEqual(d, { title: 'Soccer practice', kidId: 'y', category: 'Sports', date: '2026-10-23', time: '18:00', endTime: '19:30',
    location: 'Rec Center', pickupBy: '', notes: 'Bring shin guards', repeat: 'none' });
});

test('events without a real date or a title are dropped, not guessed', () => {
  const out = S.toDrafts([ev({ date: '2026-02-30' }), ev({ date: 'Friday' }), ev({ title: '  ' }), null, 'x', ev({ date: '' })], kids);
  assert.equal(out.length, 0);
  assert.deepEqual(S.toDrafts('nope', kids), []);
});

test('times are normalized and a bad end time is cleared', () => {
  assert.equal(S.time('9:05'), '09:05');
  assert.equal(S.time('24:00'), '');
  assert.equal(S.time('6pm'), '');
  assert.equal(S.toDrafts([ev({ time: '18:00', endTime: '17:00' })], kids)[0].endTime, '');
  const allDay = S.toDrafts([ev({ time: '', endTime: '10:00' })], kids)[0];
  assert.equal(allDay.time, ''); assert.equal(allDay.endTime, '');
});

test('children are matched by full or first name, otherwise whole family', () => {
  assert.equal(S.kidFor('yuna', kids), 'y');
  assert.equal(S.kidFor('Leo', kids), 'l');
  assert.equal(S.kidFor('Sam', kids), '');
  assert.equal(S.kidFor('', kids), '');
  assert.equal(S.kidFor('Mia', [...kids, { id: 'm2', name: 'Mia Lee' }]), 'm', 'exact name wins');
  assert.equal(S.kidFor('Mia K', [{ id: 'a', name: 'Mia A' }, { id: 'b', name: 'Mia B' }]), '', 'ambiguous first name');
});

test('unknown categories fall back to Other and long text is trimmed', () => {
  const d = S.toDrafts([ev({ category: 'Party', title: 'x'.repeat(200), location: 'y'.repeat(200), notes: 'z'.repeat(900) })], kids)[0];
  assert.equal(d.category, 'Other');
  assert.equal(d.title.length, 90); assert.equal(d.location.length, 120); assert.equal(d.notes.length, 500);
});

test('weekly repeats keep valid weekdays and a sensible end date', () => {
  const d = S.toDrafts([ev({ repeatWeekdays: [4, 2, 2, 9, 1.5], until: '2026-12-18' })], kids)[0];
  assert.equal(d.repeat, 'weekly'); assert.deepEqual(d.days, [2, 4]); assert.equal(d.interval, 1); assert.equal(d.until, '2026-12-18');
  assert.equal(S.toDrafts([ev({ repeatWeekdays: [4], until: '2026-01-01' })], kids)[0].until, '');
});

test('duplicates are removed and results are in date order', () => {
  const out = S.toDrafts([ev({ date: '2026-11-02' }), ev({ date: '2026-10-25', time: '' }), ev({ date: '2026-11-02', title: 'soccer PRACTICE' }), ev({ date: '2026-10-25', time: '09:00' })], kids);
  assert.deepEqual(out.map(d => d.date + ' ' + d.time), ['2026-10-25 ', '2026-10-25 09:00', '2026-11-02 18:00']);
});

test('already-planned activities are spotted', () => {
  const d = S.toDrafts([ev()], kids)[0];
  assert.ok(S.isDuplicate(d, [{ title: 'Soccer Practice ', date: '2026-10-23', time: '18:00' }]));
  assert.ok(!S.isDuplicate(d, [{ title: 'Soccer practice', date: '2026-10-23', time: '17:00' }]));
});

test('photos are scaled down to the AI size limit, never up', () => {
  assert.deepEqual(S.fitSize(4032, 3024), { width: 1568, height: 1176 });
  assert.deepEqual(S.fitSize(1170, 2532), { width: 725, height: 1568 });
  assert.deepEqual(S.fitSize(800, 600), { width: 800, height: 600 });
});
