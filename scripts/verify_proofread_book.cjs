// Check that the actual text renderer preserves every character in the data.
// This runs locally in Node; it does not open a browser or touch study records.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const raw = fs.readFileSync(path.join(root, 'dist/book-data.js'), 'utf8');
const data = JSON.parse(raw.replace(/^window\.BOOK_DATA\s*=\s*/, '').replace(/;\s*$/, ''));
const source = fs.readFileSync(path.join(root, 'dist/app.js'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'dist/entry-renderer.js'), 'utf8');
const context = vm.createContext({window:{}});
vm.runInContext(`${renderer}\nglobalThis.renderBlock = window.EntryRenderer.textBlock;`, context);
const visible = html => html.replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#39);/g, (_, name) => ({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[name])).replace(/\s+/g, '');
let blocks = 0, illustrations = 0;
assert.equal(data.entries.length, 3674);
assert.equal(data.chapters.length, 22);
assert.equal(new Set(data.entries.map(e => e.id)).size, 3674);
for (const entry of data.entries) {
  assert(entry.content.some(block => block.type === 'meaning' && block.text));
  for (const block of entry.content) {
    const html = context.renderBlock(block, entry);
    if (block.type === 'illustration') {
      assert(fs.existsSync(path.join(root, 'dist', block.src)));
      illustrations++;
    } else {
      const expected = (block.label ? `[${block.label}]` : '') + block.text;
      assert.equal(visible(html), expected.replace(/\s+/g, ''), `${entry.id}: rendered text differs`);
      blocks++;
    }
  }
  for (const part of entry.parts) assert(fs.existsSync(path.join(root, 'dist', part.src)));
}
assert(source.includes("const KEY = 'ielts-zhenjing-local-v1'"));
const results = {entries:data.entries.length, chapters:data.chapters.length, textBlocksPreserved:blocks, illustrations, sourceParts:data.entries.reduce((n,e)=>n+e.parts.length,0), storageKeyUnchanged:true};
fs.mkdirSync(path.join(root, 'tmp/pdfs/proofreading'), {recursive:true});
fs.writeFileSync(path.join(root, 'tmp/pdfs/proofreading/verification.json'), JSON.stringify(results,null,2));
console.log(JSON.stringify(results));
