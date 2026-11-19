// Self-check: Admin grant via user management, config-only Developer, bootstrap + forced password change, no self-escalation.
// Runs on a throwaway local database with made-up test credentials.
import assert from 'node:assert';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
process.env.DATABASE_URL='pglite:'+mkdtempSync(join(tmpdir(),'nf-access-'));
process.env.NOVA_DEVELOPER_EMAILS='dev@example.test';
process.env.NOVA_DEVELOPER_BOOTSTRAP_PASSWORD='boot-secret-1';
const O='http://localhost';
const req=(path:string,body:any,token='',method='POST')=>new Request(O+path,{method,headers:{origin:O,'content-type':'application/json',...(token?{cookie:'nf_session='+token}:{})},body:method==='GET'?undefined:JSON.stringify(body)});
(async()=>{
 const A=await import('../lib/auth');
 process.env.NOVA_ADMIN_PASSWORD_HASH=await A.hashPassword('admin-pass-123');
 const W=await import('../app/api/workspace/route');
 // POST runs next/server after() on success, which has no request scope here; a thrown after() error means the handler succeeded.
 const post=async(body:any,token:string)=>{try{const r=await W.POST(req('/api/workspace',body,token));return {ok:r.ok,...(await r.json())};}catch(e){if(/after|request scope/i.test(String((e as Error).message)))return {ok:true};throw e;}};
 const who=async(token:string)=>A.principal(req('/x',null,token,'GET'));

 // Developer bootstrap: wrong secret creates nothing usable; right secret signs in but every API is refused until the password changes.
 await assert.rejects(A.login(req('/api/auth',{}),'dev@example.test','wrong-secret'),/Incorrect/);
 const devTemp=await A.login(req('/api/auth',{}),'dev@example.test','boot-secret-1');
 await assert.rejects(who(devTemp),new RegExp(A.PASSWORD_CHANGE_REQUIRED.replace('.','\\.')));
 await assert.rejects(A.changePassword(req('/api/auth',{},devTemp),'nope','new-dev-password-1'),/current password/);
 await assert.rejects(A.changePassword(req('/api/auth',{},devTemp),'boot-secret-1','short'),/10 characters/);
 await A.changePassword(req('/api/auth',{},devTemp),'boot-secret-1','new-dev-password-1');
 const dev=await who(devTemp);assert.equal(dev.developer,true);assert.equal(dev.admin,true);
 await assert.rejects(A.login(req('/api/auth',{}),'dev@example.test','boot-secret-1'),/Incorrect/,'bootstrap secret is dead once the account exists');

 // Admin grants Admin through the normal worker flow; Developer cannot be granted or touched through it.
 const admin=await A.login(req('/api/auth',{}),A.ADMIN_EMAIL,'admin-pass-123');
 const mk=(email:string,roles:string[],id?:string)=>({type:'worker',worker:{id,name:email.split('@')[0],email,roles,password:id?'':'worker-pass-1',active:true}});
 let r=await post(mk('dev@example.test',['camera']),admin);assert.equal(r.ok,false);assert.match(r.error,/reserved for a developer/);
 r=await post(mk('cam@example.test',['camera','developer']),admin);assert.equal(r.ok,true);
 const cam=await A.login(req('/api/auth',{}),'cam@example.test','worker-pass-1');const camU=await who(cam);
 assert.equal(camU.developer,false,'developer is not assignable via the API');assert.equal(camU.admin,false);
 r=await post(mk('boss@example.test',['manager','admin']),admin);assert.equal(r.ok,true);
 r=await post(mk('mgr@example.test',['manager']),admin);assert.equal(r.ok,true);
 const boss=await A.login(req('/api/auth',{}),'boss@example.test','worker-pass-1');const bossU=await who(boss);assert.equal(bossU.admin,true);assert.equal(bossU.developer,false);
 const mgr=await A.login(req('/api/auth',{}),'mgr@example.test','worker-pass-1');const mgrU=await who(mgr);assert.equal(mgrU.admin,false);

 // No self-escalation: a manager can't grant anything; nobody changes their own access; developer is protected from admins.
 r=await post(mk('mgr@example.test',['manager','admin'],mgrU.id),mgr);assert.match(r.error,/Administrator access required/);
 r=await post(mk('boss@example.test',['manager'],bossU.id),boss);assert.match(r.error,/own access/);
 r=await post({type:'worker-toggle',id:bossU.id,active:false},boss);assert.match(r.error,/own account/);
 r=await post({type:'worker-toggle',id:dev.id,active:false},boss);assert.match(r.error,/server configuration/);
 r=await post({type:'remove-worker',id:dev.id},admin);assert.match(r.error,/server configuration/);
 r=await post(mk('dev@example.test',['camera'],dev.id),admin);assert.match(r.error,/server configuration/);
 // Revoke: a granted admin removes Admin from another admin through the same flow.
 r=await post(mk('mgr@example.test',['manager','admin'],mgrU.id),boss);assert.equal(r.ok,true);
 const mgr2=await A.login(req('/api/auth',{}),'mgr@example.test','worker-pass-1');assert.equal((await who(mgr2)).admin,true);
 r=await post(mk('mgr@example.test',['manager'],mgrU.id),boss);assert.equal(r.ok,true);
 const mgr3=await A.login(req('/api/auth',{}),'mgr@example.test','worker-pass-1');assert.equal((await who(mgr3)).admin,false);
 // Config is the only switch: dropping the email from NOVA_DEVELOPER_EMAILS revokes Developer.
 process.env.NOVA_DEVELOPER_EMAILS='';const devAfter=await who(devTemp);assert.equal(devAfter.developer,false);assert.equal(devAfter.admin,false);
 console.log('access self-check ok');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
