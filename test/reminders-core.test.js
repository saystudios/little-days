const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../reminders-core.js');

const local = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const planner = () => ({
  kids: [{ id: 'y', name: 'Yuna', birthday: '2019-10-22' }, { id: 'l', name: 'Leo' }],
  events: [
    { id: 'p', title: 'Piano', kidId: 'y', date: '2026-10-19', time: '16:00', repeat: 'weekly', days: [1, 3], location: 'Studio', pickupBy: 'Mom' },
    { id: 'd', title: 'Dentist', kidId: 'l', date: '2026-10-21', time: '07:00' },
    { id: 'x', title: 'Picture day', date: '2026-10-21', time: '' }
  ],
  tasks: []
});

test('activity reminders fire the chosen minutes before, with useful details', () => {
  const list = R.build(planner(), { now: local(2026, 10, 20, 8), prefs: { minutes: 15, birthdays: false } });
  const piano = list.find(n => n.key === 'a|p|2026-10-21|16:00');
  assert.ok(piano);
  assert.equal(piano.at.getTime(), local(2026, 10, 21, 15, 45).getTime());
  assert.match(piano.title, /Piano in 15 min/);
  assert.match(piano.body, /Yuna · Studio · 🚗 Mom/);
  assert.ok(!list.some(n => n.key.includes('|x|')), 'all-day activities get no timed reminder');
});

test('nothing in the past, and repeats are covered for a month ahead', () => {
  const list = R.build(planner(), { now: local(2026, 10, 21, 15, 50), prefs: { birthdays: false } });
  const pianos = list.filter(n => n.key.startsWith('a|p|')).map(n => n.key.split('|')[2]);
  assert.deepEqual(pianos.slice(0, 2), ['2026-10-26', '2026-10-28'], 'today’s 4:00 reminder (3:50) already passed');
  assert.ok(pianos.includes('2026-11-16'), 'weeks ahead are scheduled too, so reminders keep coming if the app stays closed');
  assert.ok(!pianos.some(d => d > '2026-11-20'), 'nothing past the 30-day window');
});

test('sports: reminder before timed practices and a packing reminder the evening before tournaments', () => {
  const sports = [
    { id: 't1', title: 'TKD tournament', athlete: 'Yuna', sport: 'Taekwondo', kind: 'Tournament', date: '2026-10-24', time: '08:30', location: 'Civic Center' },
    { id: 'p1', title: 'Soccer practice', athlete: 'Leo', sport: 'Soccer', kind: 'Practice', date: '2026-10-22', time: '17:00' },
    { id: 'old', title: 'Old', kind: 'Tournament', date: '2026-10-01' },
    { id: 'bad', title: 'Bad', kind: 'Tournament', date: 'soon' }
  ];
  const list = R.build({ kids: [], events: [], tasks: [] }, { now: local(2026, 10, 20, 8), prefs: { minutes: 30, birthdays: false }, sports });
  const prep = list.find(n => n.key === 'sp|t1|2026-10-24');
  assert.equal(prep.at.getTime(), local(2026, 10, 23, 19, 0).getTime());
  assert.match(prep.title, /Pack for TKD tournament tomorrow/);
  assert.match(prep.body, /Yuna · Taekwondo · Civic Center/);
  const practice = list.find(n => n.key === 'sa|p1|2026-10-22|17:00');
  assert.equal(practice.at.getTime(), local(2026, 10, 22, 16, 30).getTime());
  assert.ok(!list.some(n => n.key.startsWith('sp|p1')), 'practices get no packing reminder');
  assert.ok(!list.some(n => /old|bad/.test(n.key)));
  const off = R.build({ kids: [], events: [], tasks: [] }, { now: local(2026, 10, 20, 8), prefs: { sports: false, birthdays: false }, sports });
  assert.equal(off.length, 0);
});

test('quiet hours drop reminders, including windows across midnight', () => {
  const list = R.build(planner(), { now: local(2026, 10, 20, 8), prefs: { minutes: 30, quiet: true, quietStart: '21:00', quietEnd: '07:00', birthdays: false } });
  assert.ok(!list.some(n => n.key.startsWith('a|d|')), 'dentist reminder at 6:30 is inside quiet hours');
  assert.equal(R.isQuiet(local(2026, 10, 20, 23, 0), { quiet: true, quietStart: '21:00', quietEnd: '07:00' }), true);
  assert.equal(R.isQuiet(local(2026, 10, 20, 7, 0), { quiet: true, quietStart: '21:00', quietEnd: '07:00' }), false);
  assert.equal(R.isQuiet(local(2026, 10, 20, 13, 0), { quiet: true, quietStart: '12:00', quietEnd: '14:00' }), true);
  const loud = R.build(planner(), { now: local(2026, 10, 20, 8), prefs: { minutes: 30, quiet: false, birthdays: false } });
  assert.ok(loud.some(n => n.key.startsWith('a|d|')));
});

test('birthdays and the morning summary', () => {
  const list = R.build(planner(), { now: local(2026, 10, 20, 8), prefs: { summary: true, summaryTime: '07:30' } });
  const b = list.find(n => n.kind === 'birthday');
  assert.equal(b.title, '🎂 Yuna turns 7 today!');
  assert.equal(b.at.getTime(), local(2026, 10, 22, 7, 30).getTime());
  const s = list.find(n => n.key === 's|2026-10-21');
  assert.equal(s.title, 'Today: 3 activities');
  assert.match(s.body, /First: Dentist at/);
  assert.ok(!list.some(n => n.key === 's|2026-10-20'), "today's summary time already passed");
  assert.ok(!list.some(n => n.key === 's|2026-10-24'), 'no summary on empty days');
});

test('reminder times stay on the wall clock across the November DST change', () => {
  const p = { kids: [], tasks: [], events: [{ id: 'c', title: 'Class', date: '2026-10-25', time: '09:00', repeat: 'weekly' }] };
  const list = R.build(p, { now: local(2026, 10, 30, 12), prefs: { minutes: 10, birthdays: false, quiet: false } });
  const n = list.find(x => x.key === 'a|c|2026-11-01|09:00');
  assert.equal(n.at.getHours(), 8);
  assert.equal(n.at.getMinutes(), 50);
});

test('at most 60 reminders (iOS limit), soonest first, with stable ids', () => {
  const p = { kids: [], tasks: [], events: Array.from({ length: 20 }, (_, i) => ({ id: 'e' + i, title: 'E' + i, date: '2026-10-20', time: '12:00', repeat: 'daily' })) };
  const a = R.build(p, { now: local(2026, 10, 20, 8), prefs: { quiet: false } });
  const b = R.build(p, { now: local(2026, 10, 20, 8), prefs: { quiet: false } });
  assert.equal(a.length, R.MAX);
  for (let i = 1; i < a.length; i++) assert.ok(a[i].at >= a[i - 1].at);
  assert.deepEqual(a.map(n => n.id), b.map(n => n.id));
  assert.ok(a.every(n => Number.isInteger(n.id) && n.id > 0 && n.id < 2 ** 31));
  assert.equal(new Set(a.map(n => n.id)).size, a.length, 'ids are unique');
});
