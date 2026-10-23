const fs=require('node:fs'), path=require('node:path');
const root=path.resolve(__dirname,'..');
const assets=process.argv[2] ? path.resolve(process.argv[2],'site') : path.join(root,'android/build/assets/site');
fs.mkdirSync(assets,{recursive:true});
fs.cpSync(path.join(root,'dist'),assets,{recursive:true});
console.log('Offline Android assets prepared');
