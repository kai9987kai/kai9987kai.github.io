// Local-only static server. No installation or build required.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),port=Number(process.env.PORT||8080);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.md':'text/plain','.png':'image/png','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost'),relative=decodeURIComponent(url.pathname);
    const file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
    if(!file.startsWith(root+path.sep)||relative.split(/[\\/]/).some(p=>p.startsWith('.'))||!['GET','HEAD'].includes(req.method)) {res.writeHead(403);res.end();return;}
    fs.stat(file,(error,stat)=>{
      if(error||!stat.isFile()) {res.writeHead(404);res.end('Not found');return;}
      res.writeHead(200,{'Content-Type':(types[path.extname(file)]||'application/octet-stream')+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      if(req.method==='HEAD') res.end();else fs.createReadStream(file).pipe(res);
    });
  } catch {res.writeHead(400);res.end('Bad request');}
}).listen(port,'127.0.0.1',()=>console.log(`DIAMOND SIM: http://127.0.0.1:${port}`));
