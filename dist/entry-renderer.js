(() => {
  'use strict';
  const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function bookText(text, entry) {
    const needle = entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b(${needle})\\b`, 'gi');
    return text.split(pattern).map((part, index) => index % 2 ? `<strong lang="en">${escape(part)}</strong>` : escape(part)).join('');
  }
  function phoneticText(text) {
    // The original book prints these two alternative weak vowels vertically.
    // Both characters remain selectable text, including when copied.
    return escape(text).replaceAll('ᶦₔ', '<span class="ipa-alternative"><span>ᶦ</span><span>ₔ</span></span>');
  }
  function textBlock(block, entry) {
    if (block.type === 'illustration') return `<figure class="book-illustration"><img src="${escape(block.src)}" width="${block.width}" height="${block.height}" loading="lazy" alt="${escape(block.alt || '原书插图')}"></figure>`;
    const label = block.label ? `<span class="entry-label">[${escape(block.label)}]</span>` : '';
    if (block.type === 'meaning') {
      const senses = block.text.split(/(?=\/[^/\s]{1,48}\/\s*(?:n|v|vt|vi|adj|adv|prep)\.)/i).filter(text => text.trim());
      return `<div class="entry-block entry-meaning">${senses.map(sense => {
        const phonetic = sense.match(/^\s*(\/[^/]+\/)\s*/);
        return `<p class="meaning-sense">${phonetic ? `<span class="meaning-phonetic" lang="en">${phoneticText(phonetic[1])}</span>` : ''}${bookText(phonetic ? sense.slice(phonetic[0].length) : sense,entry)}</p>`;
      }).join('')}</div>`;
    }
    if (block.type === 'example') {
      // Keep the original wording; the translation starts on its own line.
      const chinese = block.text.search(/[\u3400-\u9fff]/);
      if (chinese > 0 && /[a-zA-Z]/.test(block.text.slice(0, chinese))) {
        return `<div class="entry-block entry-example"><p class="example-en" lang="en">${label}${bookText(block.text.slice(0, chinese).trim(), entry)}</p><p class="example-zh" lang="zh-CN">${bookText(block.text.slice(chinese).trim(), entry)}</p></div>`;
      }
    }
    return `<p class="entry-block entry-${escape(block.type)}">${label}${bookText(block.text, entry)}</p>`;
  }
  window.EntryRenderer = Object.freeze({bookText, phoneticText, textBlock});
})();
