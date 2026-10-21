/* Quick recurring schedule presets. Uses the existing event editor and recurrence engine. */
(function () {
  'use strict';
  const sheet = document.getElementById('sheet');
  if (!sheet) return;
  function enhance() {
    const form = sheet.querySelector('#editForm');
    const repeat = form?.querySelector('[name="repeat"]');
    if (!repeat || form.querySelector('#ldQuickSchedule')) return;
    const wrapper = document.createElement('div');
    wrapper.id = 'ldQuickSchedule';
    wrapper.className = 'field';
    const label = document.createElement('label');
    label.htmlFor = 'ldPreset';
    label.textContent = 'Quick schedule';
    const select = document.createElement('select');
    select.id = 'ldPreset';
    for (const [v, text] of [['','Choose a schedule'],['school','School · Monday–Friday'],['weekly','Weekly practice'],['daily','Every day']]) {
      const option = document.createElement('option');
      option.value = v;
      option.textContent = text;
      select.append(option);
    }
    select.onchange = () => {
      if (!select.value) return;
      const kind = select.value;
      repeat.value = kind === 'daily' ? 'daily' : 'weekly';
      repeat.dispatchEvent(new Event('change', { bubbles: true }));
      if (kind !== 'daily') {
        const dateValue = form.querySelector('[name="date"]')?.value;
        const weekday = dateValue ? new Date(dateValue + 'T12:00:00').getDay() : new Date().getDay();
        const selected = kind === 'school' ? [1,2,3,4,5] : [weekday];
        form.querySelectorAll('[name="days"]').forEach(check => { check.checked = selected.includes(Number(check.value)); });
      }
      select.value = '';
    };
    wrapper.append(label, select);
    repeat.closest('.field')?.before(wrapper);
  }
  new MutationObserver(enhance).observe(sheet, { childList: true });
  enhance();
})();
