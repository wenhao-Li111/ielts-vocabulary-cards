const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'), vm=require('node:vm');
test('reminder hides the answer until requested, counts once, and opens the exact word without auto-dismiss', () => {
  const listeners={}, elements={}, calls=[], data=new Map();
  for(const id of ['word','reveal','explanation','dismiss','open-app','reminder-footer']) elements[id]={hidden:id==='explanation',innerHTML:'',textContent:'',setAttribute(){},addEventListener(type,fn){listeners[id+':'+type]=fn;}};
  const entry={id:'w0042',word:'example',phonetic:'/ɪɡˈzɑːmpl/',content:[{type:'meaning',text:'n. 示例'}]};
  const context=vm.createContext({
    window:{BOOK_DATA:{entries:[entry]},EntryRenderer:{phoneticText:x=>x,textBlock:b=>b.text},desktopAPI:{expandReminder:x=>calls.push(['expand',x]),closeReminder:()=>calls.push(['close']),openWord:id=>calls.push(['open',id])}},
    document:{getElementById:id=>elements[id]},location:{search:'?word=w0042'},URLSearchParams,Date,Set,
    localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)}
  });
  vm.runInContext(fs.readFileSync('desktop/reminder.js','utf8'),context);
  assert.equal(elements.word.textContent,'example');
  assert.equal(elements.explanation.innerHTML,'');assert.equal(elements.explanation.hidden,true);
  assert.equal(data.size,0);
  listeners['word:click']();
  assert.equal(elements.explanation.hidden,false);assert.match(elements.explanation.innerHTML,/示例/);
  listeners['reveal:click'](); assert.equal(elements.explanation.hidden,true);
  listeners['reveal:click']();
  const saved=JSON.parse(data.get('ielts-zhenjing-local-v1'));
  assert.deepEqual(Object.values(saved.days),[['w0042']]);
  listeners['open-app:click']();
  assert.deepEqual(calls.at(-1),['open','w0042']);assert.equal(calls.some(c=>c[0]==='close'),false);
  listeners['dismiss:click']();assert.deepEqual(calls.at(-1),['close']);
});
