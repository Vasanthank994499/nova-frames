// Real HTTP test of origin checks behind a local reverse proxy. Throwaway DB; no external network.
// client → proxy :3300 (sets X-Forwarded-Host/Proto, overwriting anything the client sent) → app :3301 (real /api/auth POST handler).
import assert from 'node:assert';
import http from 'node:http';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
process.env.DATABASE_URL='pglite:'+mkdtempSync(join(tmpdir(),'nf-proxy-'));delete process.env.APP_ORIGINS;delete process.env.TRUST_PROXY_HEADERS;
(async()=>{
 const {hashPassword}=await import('../lib/auth');process.env.NOVA_ADMIN_PASSWORD_HASH=await hashPassword('Proxy-Test-123');
 const {POST}=await import('../app/api/auth/route');
 const app=http.createServer(async(req,res)=>{const chunks:Buffer[]=[];for await(const c of req)chunks.push(c as Buffer);
  const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(typeof v==='string')headers.set(k,v);
  const r=await POST(new Request('http://127.0.0.1:3301'+req.url,{method:req.method,headers,body:Buffer.concat(chunks)}));res.writeHead(r.status,{'content-type':'application/json'});res.end(await r.text());}).listen(3301,'127.0.0.1');
 const proxy=http.createServer((req,res)=>{const headers={...req.headers,'x-forwarded-host':req.headers.host||'','x-forwarded-proto':'http'};
  const up=http.request({host:'127.0.0.1',port:3301,path:req.url,method:req.method,headers},u=>{res.writeHead(u.statusCode||502,u.headers);u.pipe(res);});req.pipe(up);}).listen(3300,'127.0.0.1');
 await new Promise(r=>setTimeout(r,200));
 const login=async(port:number,origin:string|null,extra:Record<string,string>={})=>{const r=await new Promise<{s:number,b:string}>((ok,bad)=>{const q=http.request({host:'127.0.0.1',port,path:'/api/auth',method:'POST',headers:{'content-type':'application/json',...(origin!==null?{origin}:{}),...extra}},res=>{let b='';res.on('data',d=>b+=d);res.on('end',()=>ok({s:res.statusCode||0,b}));});q.on('error',bad);q.end(JSON.stringify({email:'novaframes02@gmail.com',password:'Proxy-Test-123'}));});return r.b.includes('"ok":true')?'OK':JSON.parse(r.b).error;};
 const results:string[]=[];const check=async(label:string,got:Promise<string>,want:string)=>{const g=await got;results.push(`${g===want||(want!=='OK'&&g!=='OK')?'PASS':'FAIL'}  ${label} → ${g}`);assert(want==='OK'?g==='OK':g!=='OK',label+' got '+g);};
 // Trust OFF (default): proxied browser origin is refused, direct own-origin works.
 await check('trust off · via proxy · Origin http://127.0.0.1:3300',login(3300,'http://127.0.0.1:3300'),'REJECT');
 await check('trust off · direct · Origin http://127.0.0.1:3301',login(3301,'http://127.0.0.1:3301'),'OK');
 await check('trust off · direct · spoofed X-Forwarded-Host',login(3301,'http://nova.example',{'x-forwarded-host':'nova.example','x-forwarded-proto':'http'}),'REJECT');
 process.env.TRUST_PROXY_HEADERS='1';
 await check('trust on · via proxy · Origin http://127.0.0.1:3300',login(3300,'http://127.0.0.1:3300'),'OK');
 for(const o of ['https://evil.example','http://127.0.0.1:3300.evil.example','null','not a url','http://127.0.0.1:3399','https://127.0.0.1:3300'])await check(`trust on · via proxy · Origin ${o}`,login(3300,o),'REJECT');
 await check('trust on · via proxy · no Origin header',login(3300,null),'REJECT');
 await check('trust on · via proxy · client tries to spoof X-Forwarded-Host=evil (proxy overwrites)',login(3300,'http://evil.example',{'x-forwarded-host':'evil.example'}),'REJECT');
 process.env.APP_ORIGINS='https://studio.example';
 await check('trust on + APP_ORIGINS · via proxy · configured https://studio.example',login(3300,'https://studio.example'),'OK');
 await check('trust on + APP_ORIGINS · via proxy · https://studio.example.evil',login(3300,'https://studio.example.evil'),'REJECT');
 delete process.env.TRUST_PROXY_HEADERS;delete process.env.APP_ORIGINS;
 await check('trust removed again · via proxy · Origin http://127.0.0.1:3300',login(3300,'http://127.0.0.1:3300'),'REJECT');
 console.log(results.join('\n'));app.close();proxy.close();console.log('trusted-proxy check ok');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
