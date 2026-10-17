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

/* ---------- Richer repeats (Phase 3) ---------- */
test('weekly on several days: every Monday and Wednesday', () => {
  const e = { id: 'r', date: '2026-10-05', repeat: 'weekly', days: [1, 3] };
  assert.deepEqual(days(e, '2026-10-01', '2026-10-21'), ['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14', '2026-10-19', '2026-10-21']);
});

test('weekly days before the start date in the first week are skipped', () => {
  const e = { id: 'r', date: '2026-10-07', repeat: 'weekly', days: [1, 3, 5] }; // starts Wed
  assert.deepEqual(days(e, '2026-10-04', '2026-10-13'), ['2026-10-07', '2026-10-09', '2026-10-12']);
});

test('every 2 weeks keeps its rhythm far into the future and across DST', () => {
  const e = { id: 'r', date: '2026-10-06', repeat: 'weekly', interval: 2, days: [2] };
  assert.deepEqual(days(e, '2026-10-01', '2026-11-30'), ['2026-10-06', '2026-10-20', '2026-11-03', '2026-11-17']);
  assert.deepEqual(days(e, '2027-03-01', '2027-03-31'), ['2027-03-09', '2027-03-23']);
  // A view starting in an "off" week still finds the right weeks.
  assert.deepEqual(days(e, '2026-10-11', '2026-10-24'), ['2026-10-20']);
});

test('every other day', () => {
  const e = { id: 'r', date: '2026-10-01', repeat: 'daily', interval: 2 };
  assert.deepEqual(days(e, '2026-10-04', '2026-10-10'), ['2026-10-05', '2026-10-07', '2026-10-09']);
});

test('monthly on a date skips months without that day', () => {
  const e = { id: 'r', date: '2026-01-31', repeat: 'monthly' };
  assert.deepEqual(days(e, '2026-01-01', '2026-06-30'), ['2026-01-31', '2026-03-31', '2026-05-31']);
});

test('first Friday of every month', () => {
  const e = { id: 'r', date: '2026-10-02', repeat: 'monthly', monthBy: 'nth' };
  assert.deepEqual(days(e, '2026-10-01', '2027-01-31'), ['2026-10-02', '2026-11-06', '2026-12-04', '2027-01-01']);
});

test('third Tuesday and fifth Thursday (skips months without a fifth)', () => {
  const third = { id: 'r', date: '2026-10-20', repeat: 'monthly', monthBy: 'nth' };
  assert.deepEqual(days(third, '2026-11-01', '2027-01-31'), ['2026-11-17', '2026-12-15', '2027-01-19']);
  const fifth = { id: 'r', date: '2026-10-29', repeat: 'monthly', monthBy: 'nth' };
  assert.deepEqual(days(fifth, '2026-10-01', '2027-04-30'), ['2026-10-29', '2026-12-31', '2027-04-29']);
});

test('last Friday of every month', () => {
  const e = { id: 'r', date: '2026-10-30', repeat: 'monthly', monthBy: 'last' };
  assert.deepEqual(days(e, '2026-10-01', '2027-02-28'), ['2026-10-30', '2026-11-27', '2026-12-25', '2027-01-29', '2027-02-26']);
});

test('every 3 months on a date', () => {
  const e = { id: 'r', date: '2026-01-15', repeat: 'monthly', interval: 3 };
  assert.deepEqual(days(e, '2026-01-01', '2026-12-31'), ['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15']);
});

test('yearly birthday, Feb 29 only in leap years', () => {
  assert.deepEqual(days({ id: 'b', date: '2020-05-04', repeat: 'yearly' }, '2026-01-01', '2027-12-31'), ['2026-05-04', '2027-05-04']);
  assert.deepEqual(days({ id: 'l', date: '2024-02-29', repeat: 'yearly' }, '2025-01-01', '2028-12-31'), ['2028-02-29']);
});

test('repeat end date and skipped occurrences', () => {
  const e = { id: 'r', date: '2026-10-05', repeat: 'weekly', days: [1], until: '2026-10-26', skip: ['2026-10-12'] };
  assert.deepEqual(days(e, '2026-10-01', '2026-12-31'), ['2026-10-05', '2026-10-19', '2026-10-26']);
});

test('older planners: weekly with no days uses the start weekday', () => {
  const e = { id: 'old', date: '2026-10-25', repeat: 'weekly' };
  assert.deepEqual(days(e, '2026-11-08', '2026-11-14'), ['2026-11-08']);
});

test('describeRepeat speaks plainly', () => {
  assert.equal(core.describeRepeat({ date: '2026-10-05', repeat: 'weekly', days: [1, 3] }), 'Weekly on Mon, Wed');
  assert.equal(core.describeRepeat({ date: '2026-10-05', repeat: 'weekly', days: [1, 2, 3, 4, 5] }), 'Weekly on weekdays');
  assert.equal(core.describeRepeat({ date: '2026-10-02', repeat: 'monthly', monthBy: 'nth' }), 'Monthly on the first Friday');
  assert.equal(core.describeRepeat({ date: '2026-10-30', repeat: 'monthly', monthBy: 'last' }), 'Monthly on the last Friday');
  assert.equal(core.describeRepeat({ date: '2026-10-06', repeat: 'weekly', interval: 2, days: [2] }), 'Every 2 weeks on Tue');
  assert.equal(core.describeRepeat({ date: '2026-10-06', repeat: 'none' }), '');
});

test('expanding a long weekly series over a year stays fast', () => {
  const evs = Array.from({ length: 200 }, (_, i) => ({ id: 'e' + i, date: '2020-01-0' + (1 + (i % 7)), repeat: 'weekly', days: [1, 3, 5] }));
  const t = Date.now();
  const all = core.expandEvents(evs, '2026-01-01', '2026-12-31');
  assert.ok(all.length > 30000);
  assert.ok(Date.now() - t < 1500, 'took ' + (Date.now() - t) + 'ms');
});
