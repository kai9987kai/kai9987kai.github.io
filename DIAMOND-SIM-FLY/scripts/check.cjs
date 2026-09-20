const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
for(const file of fs.readdirSync('src').filter(f=>f.endsWith('.js'))) {
  new vm.Script(fs.readFileSync(path.join('src',file),'utf8'),{filename:file});
}
for(const file of ['index.html','worldlab.html','diamond-nexus.html','fly-diamond-nexus.html']) {
  const html=fs.readFileSync(file,'utf8');
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const src=match[1].match(/src="([^"]+)"/);
    if(src&&!/^https?:/.test(src[1])&&!fs.existsSync(src[1])) throw new Error('Missing script: '+src[1]);
    if(!src&&match[2].trim()) new vm.Script(match[2],{filename:file});
  }
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  if(new Set(ids).size!==ids.length) throw new Error('Duplicate HTML IDs in '+file);
}
console.log('All JavaScript parses; local scripts and HTML IDs checked.');
