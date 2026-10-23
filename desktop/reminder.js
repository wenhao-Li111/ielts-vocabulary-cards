(() => {
  'use strict';
  const entry = window.BOOK_DATA.entries.find(e => e.id === new URLSearchParams(location.search).get('word'));
  if (!entry) { document.getElementById('word').textContent = '没有找到词条'; return; }
  const $ = id => document.getElementById(id);
  const api = window.desktopAPI;
  $('word').textContent = entry.word;
  let expanded = false;
  function reveal() {
    expanded = !expanded;
    $('explanation').hidden = !expanded;
    $('word').setAttribute('aria-expanded', String(expanded)); $('reveal').setAttribute('aria-expanded', String(expanded));
    $('reveal').textContent = expanded ? '收起解释' : '查看解释';
    if (expanded) {
      const {phoneticText, textBlock} = window.EntryRenderer;
      $('explanation').innerHTML = (entry.phonetic ? `<p class="entry-phonetic">${phoneticText(entry.phonetic)}</p>` : '') + entry.content.map(b => textBlock(b,entry)).join('');
      try {
        const key = 'ielts-zhenjing-local-v1';
        const state = JSON.parse(localStorage.getItem(key) || 'null') || {version:1,statuses:{},days:{},view:{scope:'chapter',chapter:1,filter:'all',page:1}};
        const d = new Date(), day = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        state.days ||= {}; state.days[day] = [...new Set([...(state.days[day] || []),entry.id])];
        localStorage.setItem(key, JSON.stringify(state));
      } catch { $('reminder-footer').textContent = '记录暂未保存，请在主窗口导出备份'; }
    }
    api.expandReminder(expanded);
  }
  $('word').addEventListener('click', reveal); $('reveal').addEventListener('click', reveal);
  $('dismiss').addEventListener('click', () => api.closeReminder());
  $('open-app').addEventListener('click', () => api.openWord(entry.id));
})();
