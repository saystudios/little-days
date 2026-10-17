// Run with `npm test` (repeats these tests in several time zones).
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../planner-core.js');

const days = (e, start, end) => core.occurrences(e, start, end).map(x => x.on);

test('one-time event appears only on its day', () => {
  const e = { id: 'a', date: '2026-11-03', repeat: 'none' };
  assert.deepEqual(days(e, '2026-11-01', '2026-11-30'), ['2026-11-03']);
  assert.deepEqual(days(e, '2026-11-04', '2026-11-30'), []);
});

test('weekly event keeps its weekday across the November DST change', () => {
  const sunday = { id: 'church', date: '2026-10-25', repeat: 'weekly' };
  // Week view that starts on the Sunday after clocks fall back (was empty before the fix).
  assert.deepEqual(days(sunday, '2026-11-08', '2026-11-14'), ['2026-11-08']);
  // December month grid starts Sunday Nov 29.
  assert.deepEqual(days(sunday, '2026-11-29', '2026-12-12'), ['2026-11-29', '2026-12-06']);
});

test('weekly event keeps its weekday across the March DST change', () => {
  const sunday = { id: 'x', date: '2027-02-28', repeat: 'weekly' };
  assert.deepEqual(days(sunday, '2027-03-14', '2027-03-20'), ['2027-03-14']);
  const wed = { id: 'y', date: '2027-01-06', repeat: 'weekly' };
  assert.deepEqual(days(wed, '2027-03-07', '2027-03-20'), ['2027-03-10', '2027-03-17']);
});

test('weekly events across a full year land every 7 days', () => {
  const e = { id: 'w', date: '2026-01-04', repeat: 'weekly' };
  const all = days(e, '2026-01-01', '2026-12-31');
  assert.equal(all.length, 52);
  for (let i = 1; i < all.length; i++) {
    assert.equal(core.daysBetween(core.parseDate(all[i - 1]), core.parseDate(all[i])), 7);
  }
});

test('daily event fills each day of the range, including DST days', () => {
  const e = { id: 'd', date: '2026-10-30', repeat: 'daily' };
  assert.deepEqual(days(e, '2026-10-31', '2026-11-02'), ['2026-10-31', '2026-11-01', '2026-11-02']);
});

test('repeating event never appears before its start date', () => {
  const e = { id: 'w', date: '2026-11-20', repeat: 'weekly' };
  assert.deepEqual(days(e, '2026-11-01', '2026-11-19'), []);
});

test('month and year boundaries', () => {
  const e = { id: 'nye', date: '2026-12-31', repeat: 'daily' };
  assert.deepEqual(days(e, '2026-12-30', '2027-01-02'), ['2026-12-31', '2027-01-01', '2027-01-02']);
  const leap = { id: 'leap', date: '2028-02-22', repeat: 'weekly' };
  assert.deepEqual(days(leap, '2028-02-27', '2028-03-08'), ['2028-02-29', '2028-03-07']);
});

test('bad dates are ignored instead of crashing', () => {
  assert.deepEqual(days({ id: 'x', date: '', repeat: 'weekly' }, '2026-11-01', '2026-11-30'), []);
  assert.deepEqual(days({ id: 'x', date: '2026-02-30' }, '2026-02-01', '2026-03-31'), []);
});

test('expandEvents sorts by day then time, all-day first', () => {
  const list = core.expandEvents([
    { id: 'b', date: '2026-11-02', time: '15:00' },
    { id: 'a', date: '2026-11-02', time: '' },
    { id: 'c', date: '2026-11-01', time: '18:00' },
  ], '2026-11-01', '2026-11-02');
  assert.deepEqual(list.map(x => x.id), ['c', 'a', 'b']);
});

test('startsAt gives local wall-clock time on DST days', () => {
  const d = core.startsAt('2026-11-01', '09:30');
  assert.equal(d.getHours(), 9);
  assert.equal(d.getMinutes(), 30);
  assert.equal(core.dateKey(d), '2026-11-01');
  assert.equal(core.startsAt('2026-11-01', ''), null);
});

test('isPlanner accepts only complete planner objects', () => {
  assert.equal(core.isPlanner({ kids: [], events: [], tasks: [] }), true);
  assert.equal(core.isPlanner({ kids: [], events: [] }), false);
  assert.equal(core.isPlanner(null), false);
});
