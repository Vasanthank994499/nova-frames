import assert from 'node:assert/strict';
export async function verify(credentials,origin='http://127.0.0.1:4173'){
 if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Local preview only.');
 const cookies=new Map();
 async function req(account,path,body,method){const r=await fetch(origin+path,{method:method||(body?'POST':'GET'),headers:{Origin:origin,...(cookies.has(account)?{Cookie:cookies.get(account)}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};}
 async function ok(account,body){const r=await req(account,'/api/workspace',body);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
 async function fail(account,body){const r=await req(account,'/api/workspace',body);assert(r.status>=400,JSON.stringify(r));return r;}
 async function login(account,email,password){const r=await req(account,'/api/auth',{email,password});assert.equal(r.status,200,JSON.stringify(r.data));assert(r.cookie.includes('HttpOnly'));assert(r.cookie.includes('SameSite=Strict'));cookies.set(account,r.cookie.split(';')[0]);}
 assert.equal((await req('anonymous','/api/workspace')).status,401);
 const wrong=await req('admin','/api/auth',{email:credentials.email,password:'wrong-password'});assert.equal(wrong.status,401);
 await login('admin',credentials.email,credentials.password);
 const testPassword='Local-QA-password-38';
 for(const role of ['content','camera','editor','publisher'])await ok('admin',{type:'worker',worker:{name:`QA ${role}`,email:`${role}@qa.novaframes.example`,role,active:true,password:testPassword}});
 const workers=(await ok('admin')).workers;assert(!JSON.stringify(workers).includes('password'));
 const ids=Object.fromEntries(workers.filter(w=>w.email.endsWith('@qa.novaframes.example')).map(w=>[w.role,w.id]));
 for(const role of Object.keys(ids))await login(role,`${role}@qa.novaframes.example`,testPassword);
 await ok('admin',{type:'brand',brand:{name:'QA brand',industry:'Local QA',contact:'QA client',brief:'Do not deploy test data'}});
 let brand=(await ok('admin')).brands.find(b=>b.name==='QA brand');
 await fail('content',{type:'brand',brand:{name:'Unauthorized brand'}});
 await fail('editor',{type:'worker',worker:{name:'Unauthorized worker'}});
 let j={title:'QA production lifecycle',brandId:brand.id,videoType:'Instagram Reel',brief:'Test the actual production flow',stage:'Content',due:'2026-11-01',shootDate:'2026-10-30',priority:'Normal',contentAssignee:ids.content,cameraAssignee:ids.camera,editorAssignee:ids.editor,publisherAssignee:ids.publisher,contentLink:'',shootLink:'',editLink:'',instagramLink:'',shootCompleted:false,driveUploaded:false,systemUpdated:false,editingCompleted:false};
 await ok('admin',{type:'job',job:j});j=(await ok('admin')).jobs.find(j=>j.title==='QA production lifecycle');
 const refresh=async()=>{j=(await ok('admin')).jobs.find(x=>x.id===j.id);};
 for(const role of Object.keys(ids)){const d=await ok(role);assert.equal(d.user.role,role);assert(d.jobs.every(t=>t[`${role==='camera'?'camera':role==='publisher'?'publisher':role}Assignee`]===ids[role]));}
 await fail('content',{type:'progress',id:j.id,action:'submit-shoot',fields:{}});
 await fail('content',{type:'job',job:{...j,title:'Not permitted'}});
 await fail('content',{type:'progress',id:j.id,action:'submit-content',fields:{}});
 await ok('content',{type:'progress',id:j.id,action:'submit-content',fields:{contentLink:'https://drive.google.com/file/d/qa-content/view'}});await refresh();assert.equal(j.stage,'Shoot');
 await fail('camera',{type:'progress',id:j.id,action:'submit-shoot',fields:{shootCompleted:true,shootLink:'https://drive.google.com/drive/folders/qa-footage'}});
 await ok('camera',{type:'progress',id:j.id,action:'submit-shoot',fields:{shootCompleted:true,driveUploaded:true,systemUpdated:false,shootLink:'https://drive.google.com/drive/folders/qa-footage'}});await refresh();assert.equal(j.stage,'Editing');assert.equal(j.systemUpdated,false);
 await fail('editor',{type:'progress',id:j.id,action:'submit-edit',fields:{editLink:'https://drive.google.com/file/d/qa-edit/view'}});
 await ok('editor',{type:'progress',id:j.id,action:'submit-edit',fields:{editingCompleted:true,editLink:'https://drive.google.com/file/d/qa-edit/view'}});await refresh();assert.equal(j.stage,'Client approval');
 await fail('editor',{type:'review',id:j.id,decision:'Approved'});
 await fail('publisher',{type:'progress',id:j.id,action:'mark-posted',fields:{}});
 await fail('admin',{type:'review',id:j.id,decision:'Changes requested',notes:''});
 await ok('admin',{type:'review',id:j.id,decision:'Changes requested',notes:'Change the opening title.'});await refresh();assert.equal(j.stage,'Editing');assert.equal(j.editorAssignee,ids.editor);assert.equal(j.revisionCount,1);assert.equal(j.editingCompleted,false);
 await ok('editor',{type:'progress',id:j.id,action:'submit-edit',fields:{editingCompleted:true,editLink:'https://drive.google.com/file/d/qa-edit-v2/view'}});await refresh();assert.equal(j.approval,'Pending');
 await ok('admin',{type:'review',id:j.id,decision:'Approved',notes:'Client approved version two.'});await refresh();assert.equal(j.stage,'Ready to post');
 const ready=(await ok('publisher')).jobs.find(t=>t.id===j.id);assert.equal(ready.brandName,'QA brand');assert(ready.editLink.includes('qa-edit-v2'));
 await ok('publisher',{type:'progress',id:j.id,action:'mark-posted',fields:{notes:'Posted to Instagram'}});await refresh();assert.equal(j.stage,'Posted');assert.equal(j.instagramLink,'');
 await fail('publisher',{type:'progress',id:j.id,action:'complete',fields:{instagramLink:'https://example.com/not-instagram'}});
 await ok('publisher',{type:'progress',id:j.id,action:'complete',fields:{instagramLink:'https://www.instagram.com/reel/qa/'}});await refresh();assert.equal(j.stage,'Completed');
 await ok('admin',{type:'job',job:{...j,editLink:'https://drive.google.com/file/d/new-edit/view'}});await refresh();assert.equal(j.stage,'Client approval');assert.equal(j.approval,'Pending');assert.equal(j.instagramLink,'');
 await ok('admin',{type:'remove-brand',id:brand.id});await refresh();assert.equal(j.brandName,'QA brand');assert(!(await ok('admin')).brands.some(b=>b.id===brand.id));
 await ok('admin',{type:'delete-job',id:j.id});
 const w=workers.find(w=>w.id===ids.editor);await ok('admin',{type:'worker',worker:{...w,password:'Changed-QA-password-38'}});await fail('editor');assert.equal((await req('editor','/api/auth',{email:w.email,password:testPassword})).status,401);
 await login('editor',w.email,'Changed-QA-password-38');
 for(const role of Object.keys(ids)){await ok('admin',{type:'remove-worker',id:ids[role]});await fail(role);}
 const signout=await req('admin','/api/auth',null,'DELETE');assert.equal(signout.status,200);assert(signout.cookie.includes('Max-Age=0'));await fail('admin');
 for(let i=0;i<9;i++){const r=await req('throttle','/api/auth',{email:'throttle@qa.novaframes.example',password:'wrong-password'});assert.equal(r.status,401);if(i===8)assert(r.data.error.includes('Too many'));}
 return 'PASS: password login, protected cookies, auth isolation, role restrictions, brand/worker management, four allocations, Drive-only shoot, same-editor revisions, client approval, ready-to-post list, posted/completed stages, password resets, session invalidation, logout and login throttling.';
}
