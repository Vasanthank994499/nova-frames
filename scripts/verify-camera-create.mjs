import assert from 'node:assert/strict';
export async function verifyCameraCreate(origin='http://127.0.0.1:4174'){
 if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('Local only.');const cookies={},password='Local-QA-password-38';
 async function req(a,path,body){const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,...(cookies[a]?{Cookie:cookies[a]}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
 async function login(a,email){const r=await fetch(origin+'/api/auth',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(r.status,200);cookies[a]=r.headers.get('set-cookie').split(';')[0];}
 await login('admin','novaframes02@gmail.com');await login('camera','camera@flexible-qa.example');await login('editor','multi@flexible-qa.example');await login('manager','manager@flexible-qa.example');const d=(await req('admin','/api/workspace')).data;const brand=d.brands.find(b=>b.name==='Flexible QA brand'),worker=d.workers.find(w=>w.email==='camera@flexible-qa.example'),editor=d.workers.find(w=>w.email==='multi@flexible-qa.example');const camera=(await req('camera','/api/workspace')).data;assert(camera.brands.some(b=>b.id===brand.id));assert(!camera.brands.find(b=>b.id===brand.id).email);
 const base={title:'Cameraman creation QA video',brandId:brand.id,videoType:'Instagram Reel',brief:'Camera-created project',shootDate:'2026-10-20',stage:'Content'};assert.equal((await req('camera','/api/workspace',{type:'job',job:base})).status,200);let j=(await req('camera','/api/workspace')).data.jobs.find(j=>j.title===base.title);assert(j);assert.equal(j.createdBy,worker.id);assert.equal(j.cameraAssignee,worker.id);assert.equal(j.contentAssignee,'');assert.equal(j.editorAssignee,'');assert.equal(j.stage,'Content');
 assert((await req('camera','/api/workspace',{type:'job',job:{...j,title:'Unauthorized edit'}})).status>=400);
 assert((await req('camera','/api/workspace',{type:'job',job:{...base,title:'Bad allocation',editorAssignee:editor.id}})).status>=400);
 assert((await req('camera','/api/workspace',{type:'job',job:{...base,title:'Skip workflow',stage:'Posted'}})).status>=400);
 assert((await req('editor','/api/workspace',{type:'job',job:{...base,title:'Editor cannot create'}})).status>=400);
 assert.equal((await req('manager','/api/workspace',{type:'allocate',id:j.id,allocations:{...j,contentAssignee:editor.id,editorAssignee:editor.id}})).status,200);
 assert.equal((await req('admin','/api/workspace',{type:'delete-job',id:j.id})).status,200);
 return 'PASS: cameraman creates an active-brand video, owns its camera allocation and creator record, sees it after save; existing-job edits, other-worker allocation and workflow skipping remain restricted. Manager allocation still works.';
}
