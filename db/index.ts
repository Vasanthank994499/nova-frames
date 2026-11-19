import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;
export function getDb() {
 const url=process.env.DATABASE_URL;
 if(!url) throw new Error('Production database is not configured. Connect the Neon database to this Vercel project.');
 if(url.startsWith('pglite:')&&process.env.NODE_ENV!=='production')return database ??= localDb(url.slice(7)) as NonNullable<typeof database>;
 return database ??= drizzle(neon(url),{schema});
}
// Local development only: embedded Postgres in a folder (DATABASE_URL=pglite:./.local-db), schema from drizzle/postgres/.
// Two PGlite instances on one folder corrupt it ("RuntimeError: Aborted()"). Hot reload re-runs this module and resets
// `database`, so the instance lives on globalThis (one per folder per process), and a lock file stops a second process.
function localDb(dir:string){
 // Next provides require; plain Node ESM (scripts/verify-*) does not.
 const load:NodeJS.Require=typeof require==='function'?require:(process as any).getBuiltinModule('module').createRequire(process.cwd()+'/');
 const {PGlite}=load('@electric-sql/pglite'),{drizzle:local}=load('drizzle-orm/pglite'),fs=load('fs'),path=load('path');
 const abs=path.resolve(dir),cache=((globalThis as any).__novaLocalDbs??=new Map());
 if(cache.has(abs))return cache.get(abs);
 const lock=abs+'.owner.pid',alive=(pid:number)=>{try{process.kill(pid,0);return true;}catch(e:any){return e?.code==='EPERM';}};
 try{const owner=Number(fs.readFileSync(lock,'utf8'));if(owner&&owner!==process.pid&&alive(owner))throw Object.assign(new Error(`Local database ${abs} is already open in process ${owner}. Stop that dev server (or build/script) first; two processes on one folder corrupt it.`),{code:'LOCAL_DB_IN_USE'});}
 catch(e:any){if(e?.code==='LOCAL_DB_IN_USE')throw e;}
 fs.mkdirSync(path.dirname(abs),{recursive:true});fs.writeFileSync(lock,String(process.pid));
 process.once('exit',()=>{try{if(Number(fs.readFileSync(lock,'utf8'))===process.pid)fs.unlinkSync(lock);}catch{}});
 const client=new PGlite(abs),sqlDir=path.join(process.cwd(),'drizzle/postgres');
 for(const f of fs.readdirSync(sqlDir).filter((f:string)=>f.endsWith('.sql')).sort())client.exec(fs.readFileSync(path.join(sqlDir,f),'utf8').replace(/--> statement-breakpoint/g,'').replace(/CREATE TABLE "/g,'CREATE TABLE IF NOT EXISTS "'));
 const db=local(client,{schema});cache.set(abs,db);return db;
}
