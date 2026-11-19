// Self-check for the local PGlite guard in db/index.ts: hot-reload style re-imports reuse one instance (no corruption),
// a second live process is refused with a clear error, and a stale lock from a dead process is taken over.
import assert from 'node:assert';
import {mkdtempSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {sql} from 'drizzle-orm';
// The child run ('second') keeps the DATABASE_URL it was given; only the parent picks a fresh folder.
const dir=process.argv[2]==='second'?process.env.DATABASE_URL!.slice(7):join(mkdtempSync(join(tmpdir(),'nf-localdb-')),'db');process.env.DATABASE_URL='pglite:'+dir;
// A changing query string makes Node load a fresh copy of the module, like a hot reload does.
const fresh=(k:unknown):string=>'../db/index.ts?reload='+k;
(async()=>{
 if(process.argv[2]==='second'){try{const {getDb}=await import('../db');await getDb().execute(sql`SELECT 1`);console.log('SECOND OPENED');}catch(e){console.log('SECOND REFUSED: '+(e as Error).message.slice(0,300));}process.exit(0);}
 for(let k=0;k<5;k++){const {getDb}=await import(fresh(k));const db=getDb();
  await db.execute(sql`CREATE TABLE IF NOT EXISTS t(id serial primary key, v text)`);for(let i=0;i<40;i++)await db.execute(sql`INSERT INTO t(v) VALUES (${'r'+k+'-'+i})`);}
 const {getDb}=await import(fresh('final'));const n=((await getDb().execute(sql`SELECT count(*)::int AS n FROM t`)) as any).rows[0].n;
 assert.equal(n,200,'all rows kept across 5 module reloads');assert(existsSync(dir+'.owner.pid'),'lock file written');
 const out=execFileSync(process.execPath,['--import','tsx',process.argv[1],'second'],{env:{...process.env,DATABASE_URL:'pglite:'+dir},encoding:'utf8'});
 assert.match(out,/SECOND REFUSED: Local database .* is already open in process/,out);
 // Stale lock (dead pid) is taken over on a fresh folder.
 const dir2=dir+'2';writeFileSync(dir2+'.owner.pid','999999');
 const out2=execFileSync(process.execPath,['--import','tsx',process.argv[1],'second'],{env:{...process.env,DATABASE_URL:'pglite:'+dir2},encoding:'utf8'});
 assert.match(out2,/SECOND OPENED/,out2);
 console.log('local db guard self-check ok');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
