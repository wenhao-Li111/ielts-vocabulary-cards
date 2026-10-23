(() => {
  'use strict';
  const book = window.BOOK_DATA;
  const KEY = 'ielts-zhenjing-local-v1';
  const PAGE_SIZE = 24;
  const $ = (id) => document.getElementById(id);
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const byId = new Map(book.entries.map((entry, index) => [entry.id, {...entry, index: index + 1}]));
  const chapterById = new Map(book.chapters.map((chapter) => [chapter.id, chapter]));
  const entries = [...byId.values()];
  const validStatuses = new Set(['mastered', 'unfamiliar']);
  const searchText = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const emptyState = () => ({version:1, statuses:{}, days:{}, view:{scope:'chapter',chapter:1,filter:'all',page:1}});
  let storageProblem = false;
  const clean = (input) => {
    const result = emptyState();
    if (!input || typeof input !== 'object') return result;
    if (input.statuses && typeof input.statuses === 'object') {
      for (const [id, value] of Object.entries(input.statuses)) if (byId.has(id) && validStatuses.has(value)) result.statuses[id] = value;
    }
    if (input.days && typeof input.days === 'object') {
      for (const [date, ids] of Object.entries(input.days)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Array.isArray(ids)) result.days[date] = [...new Set(ids.filter(id => byId.has(id)))];
      }
    }
    const view = input.view || {};
    if (['chapter','all','notebook'].includes(view.scope)) result.view.scope = view.scope;
    if (chapterById.has(view.chapter)) result.view.chapter = view.chapter;
    if (['all','unmastered','mastered'].includes(view.filter)) result.view.filter = view.filter;
    if (Number.isInteger(view.page) && view.page > 0) result.view.page = Math.min(view.page, Math.ceil(book.total/PAGE_SIZE));
    return result;
  };
  function readState() {
    try { const raw = localStorage.getItem(KEY); return raw ? clean(JSON.parse(raw)) : emptyState(); }
    catch { storageProblem = true; return null; }
  }
  let state = readState() || emptyState();
  let query = '', notebookQuery = '', pageEntries = [], filtered = [], totalPages = 1, toastTimer;
  let day = localDate();
  const revealed = new Set();
  let dialogEntryId = null;
  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3200);
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch {
      if (!storageProblem) toast('浏览器无法保存记录，请使用「导出进度」备份。');
      storageProblem = true;
    }
  }
  function mergeLatest() {
    if (storageProblem) return;
    const latest = readState();
    if (latest) { state.statuses = latest.statuses; state.days = latest.days; }
  }
  function recordReview(id) {
    mergeLatest();
    day = localDate();
    const ids = new Set(state.days[day] || []);
    ids.add(id);
    state.days[day] = [...ids];
    persist();
    renderToday();
  }
  function renderToday() {
    $('today-count').textContent = (state.days[localDate()] || []).length;
    $('today-date').textContent = new Intl.DateTimeFormat('zh-CN', {month:'long',day:'numeric',weekday:'long'}).format(new Date());
  }
  function statusOf(id) { return state.statuses[id] || ''; }
  function scopeEntries() {
    if (state.view.scope === 'notebook') return entries.filter(e => statusOf(e.id) === 'unfamiliar');
    if (state.view.scope === 'all') return entries;
    return entries.filter(e => e.chapter === state.view.chapter);
  }
  function stats() {
    const mastered = entries.filter(e => statusOf(e.id) === 'mastered').length;
    $('total-progress-label').textContent = `${mastered.toLocaleString()} / ${book.total.toLocaleString()}`;
    $('total-progress-bar').style.width = `${mastered/book.total*100}%`;
    const source = scopeEntries();
    const count = source.filter(e => statusOf(e.id) === 'mastered').length;
    const percent = source.length ? Math.round(count/source.length*100) : 0;
    $('chapter-total').textContent = source.length.toLocaleString();
    $('chapter-mastered').textContent = count;
    $('chapter-percent').textContent = `${percent}%`;
    $('chapter-progress').style.width = `${percent}%`;
    renderToday();
  }
  function renderChapters() {
    $('chapters').innerHTML = book.chapters.map(ch => {
      const completed = entries.filter(e => e.chapter === ch.id && statusOf(e.id) === 'mastered').length;
      const active = state.view.scope === 'chapter' && ch.id === state.view.chapter;
      return `<button class="nav-item chapter-item${active?' active':''}" data-chapter="${ch.id}" ${active?'aria-current="page"':''} title="${escape(ch.title)}：已掌握 ${completed} / ${ch.count}"><span class="chapter-number">${String(ch.id).padStart(2,'0')}</span><span>${escape(ch.title)}</span>${completed===ch.count?'<i class="completed-dot" aria-label="本章全部掌握"></i>':''}<b>${ch.count}</b></button>`;
    }).join('');
    $('all-words').classList.toggle('active', state.view.scope === 'all');
    $('all-words').setAttribute('aria-current', state.view.scope === 'all' ? 'page' : 'false');
  }
  function setHeading() {
    const scope = state.view.scope;
    const chapter = chapterById.get(state.view.chapter);
    $('chapter-eyebrow').textContent = scope === 'chapter' ? `CHAPTER ${String(chapter.id).padStart(2,'0')}` : scope === 'all' ? 'THE COMPLETE VOCABULARY' : 'MY PERSONAL WORDBOOK';
    $('chapter-title').textContent = scope === 'chapter' ? chapter.title : scope === 'all' ? '全书单词' : '复习生词本';
    $('word-search').placeholder = scope === 'chapter' ? '搜索当前章节…' : scope === 'all' ? '搜索全书单词…' : '搜索生词…';
    document.title = `${$('chapter-title').textContent} · 《雅思词汇真经》· Liu Hongbo 单词卡`;
  }
  function pagesLabel(entry) { return entry.pages.map(p => String(p).padStart(3,'0')).join('、'); }
  function originalScans(entry) {
    let previousPage = entry.parts[0]?.page;
    const parts = entry.parts.map(part => {
      const divider = part.page !== previousPage ? `<div class="part-page">原书第 ${String(part.page).padStart(3,'0')} 页 · 接上页</div>` : '';
      previousPage = part.page;
      const scale = part.columnWidth || part.width;
      const width = Math.min(100, part.width/scale*100);
      const offset = (part.offsetX || 0)/scale*100;
      return `${divider}<div class="original-scan" style="width:${width.toFixed(3)}%;margin-left:${offset.toFixed(3)}%"><img src="${escape(part.src)}" width="${part.width}" height="${part.height}" loading="lazy" alt="${escape(entry.word)} 的原书内容，第 ${part.page} 页"></div>`;
    }).join('');
    return `<div class="original-parts">${parts}</div>`;
  }
  const {bookText, phoneticText, textBlock} = window.EntryRenderer;
  function explanation(entry) {
    const blocks = (entry.content || []).map(block => textBlock(block, entry)).join('');
    const phonetic = entry.phonetic ? `<p class="entry-phonetic" lang="en">${phoneticText(entry.phonetic)}</p>` : '';
    const localPdf = location.protocol === 'file:';
    const sourceUrl = localPdf ? `../${encodeURIComponent(book.sourceFile)}#page=${entry.pdfPage}` : 'https://github.com/wenhao-Li111/ielts-vocabulary-cards/tree/main/%E8%B5%84%E6%96%99';
    return `<div class="explanation-inner"><div class="explanation-tools"><span class="original-label">原书内容</span><button class="copy-entry" data-action="copy">复制文字</button></div><div class="entry-text">${phonetic}${blocks}</div><details class="source-comparison"><summary>对照原书</summary>${originalScans(entry)}</details><a class="source-link" href="${sourceUrl}" target="_blank" rel="noopener">原书第 ${pagesLabel(entry)} 页 · ${localPdf?'查看原书':'下载整本原书资料'} ${icon('arrow')}</a></div>`;
  }
  async function copyEntry(id) {
    const entry = byId.get(id);
    const text = [entry.word, entry.phonetic, ...(entry.content || []).filter(b => b.type !== 'illustration').map(b => (b.label ? `[${b.label}] ` : '') + b.text)].filter(Boolean).join('\n\n');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(text);
    } catch {
      const input = document.createElement('textarea');
      input.value = text;
      input.className = 'copy-buffer';
      input.setAttribute('aria-label', '复制词条文字');
      const previousFocus = document.activeElement;
      ($('word-dialog').open ? $('word-dialog') : document.body).append(input);
      input.select(); input.setSelectionRange(0, text.length);
      const copied = document.execCommand('copy'); input.remove();
      previousFocus?.focus({preventScroll:true});
      if (!copied) { toast('请长按或选中文字复制。'); return; }
    }
    toast('词条文字已复制');
  }
  function card(entry, inDialog = false) {
    const status = statusOf(entry.id);
    const open = !inDialog && revealed.has(entry.id);
    const contentId = `${inDialog?'dialog':'card'}-${entry.id}-content`;
    return `<article class="word-card ${status}${open?' revealed':''}" data-entry="${entry.id}" data-dialog="${inDialog}"><div class="card-top"><div><span class="card-index">${String(entry.index).padStart(4,'0')}</span><span class="card-status-label">${status==='mastered'?'已掌握':status==='unfamiliar'?'待复习':''}</span></div><div class="card-actions"><button class="mark-button" data-action="mastered" aria-pressed="${status==='mastered'}" title="${status==='mastered'?'取消掌握':'标记已掌握'}" aria-label="${status==='mastered'?'取消掌握':'标记已掌握'} ${escape(entry.word)}">${icon('check')}</button><button class="mark-button" data-action="unfamiliar" aria-pressed="${status==='unfamiliar'}" title="${status==='unfamiliar'?'移出生词本':'加入生词本'}" aria-label="${status==='unfamiliar'?'移出生词本':'加入生词本'} ${escape(entry.word)}">${icon('alert')}</button></div></div><div class="card-face"><h3 class="card-word${entry.word.length>13?' long':''}" lang="en">${escape(entry.word)}</h3></div><div class="card-bottom"><button class="reveal-button" data-action="reveal" aria-expanded="${open}" aria-controls="${contentId}">${icon('eye')}<span>${open?'收起解释':'查看解释'}</span></button><div class="card-source"><span class="chapter-tag">${escape(chapterById.get(entry.chapter).title)}</span><span>原书 P.${String(entry.pages[0]).padStart(3,'0')}</span></div></div><div class="card-explanation" id="${contentId}" ${open?'':'hidden'}>${open?explanation(entry):''}</div></article>`;
  }
  function renderCards() {
    const source = scopeEntries();
    filtered = source.filter(e => {
      if (state.view.filter === 'mastered' && statusOf(e.id) !== 'mastered') return false;
      if (state.view.filter === 'unmastered' && statusOf(e.id) === 'mastered') return false;
      return !query || searchText(e.word).includes(searchText(query));
    });
    totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    state.view.page = Math.min(state.view.page, totalPages);
    const start = (state.view.page-1)*PAGE_SIZE;
    pageEntries = filtered.slice(start, start+PAGE_SIZE);
    $('cards').innerHTML = pageEntries.map(e => card(e)).join('');
    $('empty-results').hidden = !!filtered.length;
    $('empty-message').textContent = state.view.scope === 'notebook' && !source.length ? '点击词卡上的 !，将不熟悉的单词加入生词本。' : '试试其他单词，或切换筛选条件。';
    $('results-label').textContent = filtered.length ? `共 ${filtered.length.toLocaleString()} 个词条 · 显示 ${start+1}–${start+pageEntries.length}` : '共 0 个词条';
    $('previous-page').disabled = state.view.page <= 1;
    $('next-page').disabled = state.view.page >= totalPages;
    $('page-select').innerHTML = Array.from({length:totalPages}, (_, i) => `<option value="${i+1}" ${i+1===state.view.page?'selected':''}>${i+1}</option>`).join('');
    $('page-total').textContent = `/ ${totalPages} 页`;
    document.querySelectorAll('[data-filter]').forEach(button => {
      const active = button.dataset.filter === state.view.filter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  function renderNotebook() {
    const all = entries.filter(e => statusOf(e.id) === 'unfamiliar');
    const matches = all.filter(e => searchText(e.word).includes(searchText(notebookQuery)));
    $('notebook-count').textContent = all.length;
    $('review-notebook').disabled = all.length === 0;
    $('notebook-empty').hidden = all.length > 0;
    $('notebook-list').innerHTML = matches.map(e => `<div class="notebook-row"><button data-open-word="${e.id}" aria-label="复习 ${escape(e.word)}"><span class="notebook-word" lang="en">${escape(e.word)}</span><span class="notebook-chapter">${String(e.chapter).padStart(2,'0')} · ${escape(chapterById.get(e.chapter).title)}</span></button><button class="remove-word" data-remove-word="${e.id}" title="移出生词本" aria-label="将 ${escape(e.word)} 移出生词本">${icon('close')}</button></div>`).join('') || (all.length ? '<p class="notebook-no-match">生词本中没有匹配的单词</p>' : '');
  }
  function render() { setHeading(); renderChapters(); renderCards(); renderNotebook(); stats(); }
  function closeDrawers() {
    $('chapter-sidebar').classList.remove('open');
    $('notebook').classList.remove('open');
    $('drawer-backdrop').hidden = true;
    $('menu-toggle').setAttribute('aria-expanded','false');
    $('notebook-toggle').setAttribute('aria-expanded','false');
  }
  function chooseScope(scope, chapter) {
    state.view = {scope, chapter:chapter || state.view.chapter, filter:'all', page:1};
    query = ''; $('word-search').value = ''; revealed.clear();
    closeDrawers(); render(); persist();
    window.scrollTo({top:0,behavior:'auto'});
  }
  function updateStatus(id, action, forceRemove = false) {
    mergeLatest();
    const old = statusOf(id);
    const next = forceRemove || old === action ? '' : action;
    if (next) state.statuses[id] = next; else delete state.statuses[id];
    persist();
    const opened = dialogEntryId && $('word-dialog').open ? $('dialog-card').querySelector('.reveal-button')?.getAttribute('aria-expanded') === 'true' : false;
    render();
    if (dialogEntryId && $('word-dialog').open) {
      const e = byId.get(dialogEntryId);
      $('dialog-card').innerHTML = card(e, true);
      if (opened) expandCard($('dialog-card').querySelector('.word-card'), false);
    }
    persist();
    toast(next === 'mastered' ? (old==='unfamiliar'?'已掌握，并移出生词本':'已标记掌握') : next === 'unfamiliar' ? '已加入生词本' : old==='mastered'?'已取消掌握标记':'已移出生词本');
  }
  const explanationAnimations = new WeakMap();
  function animateExplanation(content, open, animate = true) {
    // Measure the visible height before cancelling, so repeated taps reverse smoothly.
    const height = content.hidden ? 0 : content.getBoundingClientRect().height;
    const opacity = content.hidden ? 0 : Number(getComputedStyle(content).opacity);
    explanationAnimations.get(content)?.cancel();
    content.hidden = false;
    content.inert = !open;
    content.setAttribute('aria-hidden', String(!open));
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      content.hidden = !open;
      explanationAnimations.delete(content);
      return;
    }
    const target = open ? content.scrollHeight : 0;
    const animation = content.animate([
      {height:`${height}px`, opacity},
      {height:`${target}px`, opacity:open ? 1 : 0}
    ], {duration:320, easing:'cubic-bezier(.22, 1, .36, 1)', fill:'both'});
    explanationAnimations.set(content, animation);
    animation.onfinish = () => {
      if (explanationAnimations.get(content) !== animation) return;
      content.hidden = !open;
      animation.cancel();
      explanationAnimations.delete(content);
    };
  }
  function expandCard(element, count = true) {
    const entry = byId.get(element.dataset.entry);
    const content = element.querySelector('.card-explanation');
    if (!content.firstElementChild) content.innerHTML = explanation(entry);
    animateExplanation(content, true, count);
    element.classList.add('revealed');
    const button = element.querySelector('.reveal-button');
    button.setAttribute('aria-expanded','true');
    button.querySelector('span').textContent = '收起解释';
    if (element.dataset.dialog !== 'true') revealed.add(entry.id);
    if (count) recordReview(entry.id);
  }
  function toggleCard(element) {
    const button = element.querySelector('.reveal-button');
    if (button.getAttribute('aria-expanded') === 'false') { expandCard(element); return; }
    animateExplanation(element.querySelector('.card-explanation'), false);
    element.classList.remove('revealed');
    button.setAttribute('aria-expanded','false');
    button.querySelector('span').textContent = '查看解释';
    if (element.dataset.dialog !== 'true') revealed.delete(element.dataset.entry);
  }
  function changePage(page) {
    state.view.page = Math.max(1,Math.min(totalPages, page));
    revealed.clear(); renderCards(); persist();
    $('main').scrollIntoView({behavior:'auto',block:'start'});
  }
  document.addEventListener('click', event => {
    const chapterButton = event.target.closest('[data-chapter]');
    if (chapterButton) { chooseScope('chapter', Number(chapterButton.dataset.chapter)); return; }
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      const element = actionButton.closest('.word-card');
      if (actionButton.dataset.action === 'reveal') toggleCard(element);
      else if (actionButton.dataset.action === 'copy') copyEntry(element.dataset.entry);
      else updateStatus(element.dataset.entry, actionButton.dataset.action);
      return;
    }
    const filter = event.target.closest('[data-filter]');
    if (filter) { state.view.filter = filter.dataset.filter; state.view.page = 1; revealed.clear(); renderCards(); persist(); return; }
    const open = event.target.closest('[data-open-word]');
    if (open) { dialogEntryId = open.dataset.openWord; $('dialog-card').innerHTML = card(byId.get(dialogEntryId), true); $('word-dialog').showModal(); return; }
    const remove = event.target.closest('[data-remove-word]');
    if (remove) { updateStatus(remove.dataset.removeWord,'unfamiliar',true); return; }
    const close = event.target.closest('[data-close]');
    if (close) $(close.dataset.close).close();
  });
  $('all-words').addEventListener('click', () => chooseScope('all'));
  $('home-link').addEventListener('click', event => { event.preventDefault(); chooseScope('chapter',1); });
  $('review-notebook').addEventListener('click', () => chooseScope('notebook'));
  $('previous-page').addEventListener('click', () => changePage(state.view.page-1));
  $('next-page').addEventListener('click', () => changePage(state.view.page+1));
  $('page-select').addEventListener('change', event => changePage(Number(event.target.value)));
  let searchTimer;
  $('word-search').addEventListener('input', event => {
    query = event.target.value.trim(); state.view.page = 1; revealed.clear();
    clearTimeout(searchTimer); searchTimer = setTimeout(() => { renderCards(); persist(); }, 100);
  });
  $('notebook-search').addEventListener('input', event => { notebookQuery = event.target.value.trim(); renderNotebook(); });
  $('clear-filters').addEventListener('click', () => {
    query = ''; $('word-search').value = ''; state.view.filter = 'all'; state.view.page = 1;
    if (state.view.scope === 'notebook' && !scopeEntries().length) chooseScope('chapter', state.view.chapter);
    else { renderCards(); persist(); }
  });
  $('collapse-all').addEventListener('click', () => {
    $('cards').querySelectorAll('.reveal-button[aria-expanded="true"]').forEach(button => toggleCard(button.closest('.word-card')));
  });
  $('show-help').addEventListener('click', () => $('help-dialog').showModal());
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) dialog.close(); } });
  }
  $('word-dialog').addEventListener('close', () => { dialogEntryId = null; $('dialog-card').innerHTML = ''; });
  function toggleDrawer(id, button) {
    const wasOpen = $(id).classList.contains('open'); closeDrawers();
    if (!wasOpen) { $(id).classList.add('open'); $('drawer-backdrop').hidden = false; $(button).setAttribute('aria-expanded','true'); }
  }
  $('menu-toggle').addEventListener('click', () => toggleDrawer('chapter-sidebar','menu-toggle'));
  $('notebook-toggle').addEventListener('click', () => toggleDrawer('notebook','notebook-toggle'));
  $('drawer-backdrop').addEventListener('click', closeDrawers);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeDrawers(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 1040) closeDrawers(); });
  $('export-progress').addEventListener('click', () => {
    mergeLatest();
    const backup = {app:'ielts-zhenjing',version:1,exportedAt:new Date().toISOString(),...state};
    if (window.AndroidBackup?.saveBackup) {
      window.AndroidBackup.saveBackup(JSON.stringify(backup,null,2), `雅思词汇学习进度-${localDate()}.json`);
      return;
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)], {type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = `雅思词汇学习进度-${localDate()}.json`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('进度备份已导出');
  });
  $('import-progress').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 5*1024*1024) throw new Error('文件过大');
      const raw = JSON.parse(await file.text());
      if (raw.app !== 'ielts-zhenjing' || raw.version !== 1 || !raw.statuses || !raw.days || Array.isArray(raw.statuses) || Array.isArray(raw.days)) throw new Error('文件格式不正确');
      const imported = clean(raw); mergeLatest();
      state.statuses = {...state.statuses, ...imported.statuses};
      for (const [date, ids] of Object.entries(imported.days)) state.days[date] = [...new Set([...(state.days[date] || []), ...ids])];
      persist(); render(); toast('学习进度已导入并合并');
    } catch { toast('导入失败：请选择本网站导出的进度 JSON 文件。'); }
    event.target.value = '';
  });
  window.addEventListener('storage', event => {
    if (event.key !== KEY) return;
    const latest = readState();
    if (latest) { state.statuses = latest.statuses; state.days = latest.days; render(); }
  });
  setInterval(() => { if (day !== localDate()) { day=localDate(); renderToday(); } }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { mergeLatest(); stats(); } });
  function openSpecificWord(id) {
    const entry = byId.get(id); if (!entry) return;
    if ($('word-dialog').open) $('word-dialog').close();
    chooseScope('chapter', entry.chapter);
    const index = scopeEntries().findIndex(e => e.id === id);
    state.view.page = Math.floor(index / PAGE_SIZE) + 1;
    renderCards(); persist();
    const target = $('cards').querySelector(`[data-entry="${id}"]`);
    if (target) { target.classList.add('selected-word'); target.setAttribute('tabindex','-1'); target.scrollIntoView({behavior:'auto',block:'center'}); target.focus({preventScroll:true}); }
  }
  window.desktopAPI?.onOpenWord(openSpecificWord);
  render();
  const linkedWord = new URLSearchParams(location.hash.slice(1)).get('word');
  if (linkedWord) openSpecificWord(linkedWord);
  if (storageProblem) toast('无法读取浏览器记录；你可以导入备份，或先学习再导出进度。');
})();
