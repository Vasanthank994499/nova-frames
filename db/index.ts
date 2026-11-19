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
function localDb(dir:string){
 // Next provides require; plain Node ESM (scripts/verify-*) does not.
 const load:NodeJS.Require=typeof require==='function'?require:(process as any).getBuiltinModule('module').createRequire(process.cwd()+'/');
 const {PGlite}=load('@electric-sql/pglite'),{drizzle:local}=load('drizzle-orm/pglite'),fs=load('fs'),path=load('path');
 const client=new PGlite(path.resolve(dir)),sqlDir=path.join(process.cwd(),'drizzle/postgres');
 for(const f of fs.readdirSync(sqlDir).filter((f:string)=>f.endsWith('.sql')).sort())client.exec(fs.readFileSync(path.join(sqlDir,f),'utf8').replace(/--> statement-breakpoint/g,'').replace(/CREATE TABLE "/g,'CREATE TABLE IF NOT EXISTS "'));
 return local(client,{schema});
}
