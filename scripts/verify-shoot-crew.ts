import assert from 'node:assert/strict';
import {assignmentIds,assignedTo,allocationInput,cameraFields} from '../lib/shoot-assignments';
import {currentAssignees,matchesJobFilters,isUnassignedAtStage} from '../lib/job-filters';
import {reassignmentConflict} from '../lib/assignment-conflicts';
import {notificationItems} from '../lib/notification-items';
import {makeEditingJobs} from '../lib/production-batches';

const legacy={id:'job-1',stage:'Shoot',cameraAssignee:'camera-a',editorAssignee:'editor-a',title:'Shared shoot',brandId:'brand',brandName:'QA',created:'2026-10-17T09:00:00.000Z'};
assert.deepEqual(assignmentIds(legacy,'camera'),['camera-a']);
const crew={...legacy,...cameraFields(['camera-a','camera-b'])};
assert.deepEqual(currentAssignees(crew),['camera-a','camera-b']);
assert(assignedTo(crew,'camera','camera-b'));assert(!assignedTo(crew,'camera','unrelated'));assert(!assignedTo(crew,'editor','camera-b'));
assert(matchesJobFilters(crew,'Shoot','camera-b'));assert(matchesJobFilters(crew,'Shoot','assigned'));assert(!matchesJobFilters(crew,'Shoot','unassigned'));
assert(!isUnassignedAtStage(crew,'camera'));assert(isUnassignedAtStage({...crew,...cameraFields([])},'camera'));
assert.deepEqual(assignmentIds({...legacy,cameraAssignees:[]},'camera'),[]);
assert.deepEqual(allocationInput({cameraAssignees:['camera-a','camera-b','camera-a']},'camera'),['camera-a','camera-b']);
assert.deepEqual(allocationInput({cameraAssignee:'camera-a'},'camera'),['camera-a']);
for(const role of ['content','editor','publisher'])assert.throws(()=>allocationInput({[role==='content'?'contentAssignee':role==='editor'?'editorAssignee':'publisherAssignee']:['a','b']},role),/Only Shoot/);
assert.throws(()=>allocationInput({cameraAssignees:['valid',null]},'camera'),/valid cameramen/);
assert.throws(()=>allocationInput({cameraAssignees:['']},'camera'),/valid cameramen/);
assert.equal(reassignmentConflict('v1',legacy,{...crew,cameraAssignee:'camera-b'},['cameraAssignee','cameraAssignees']),null);
const single=reassignmentConflict('v1',crew,{...crew,editorAssignee:'editor-b'},['cameraAssignee','editorAssignee']);assert.equal(single?.changes.length,1);assert.equal(single?.changes[0].key,'editorAssignee');
assert.equal(reassignmentConflict('v1',crew,{...crew,editorAssignee:'editor-b'},['editorAssignee'],single?.confirmationKey),null);

const event=(id:string,second:number,cameras:string[])=>({id,jobId:crew.id,at:`2026-10-17T09:00:0${second}.000Z`,stage:'Shoot',action:'allocate',snapshot:{...crew,...cameraFields(cameras)}});
const first=event('first',0,['camera-a']),added=event('added',1,['camera-a','camera-b']),removed=event('removed',2,['camera-b']),returned=event('returned',3,['camera-a','camera-b']);
const alerts=(who:string,job:any,events:any[])=>notificationItems({id:who,admin:false,roles:['camera']},{jobs:[job],events,extraTasks:[],requests:[],hiddenBrands:new Set(),hiddenWorkers:new Set()});
assert.equal(alerts('camera-a',crew,[first,added])[0].id,'work:job-1:camera:first');
assert.equal(alerts('camera-b',crew,[first,added])[0].id,'work:job-1:camera:added');
assert.equal(alerts('unrelated',crew,[first,added]).length,0);
assert.equal(alerts('camera-a',{...crew,...cameraFields(['camera-b'])},[first,added,removed]).length,0);
assert.equal(alerts('camera-b',{...crew,...cameraFields(['camera-b'])},[first,added,removed])[0].id,'work:job-1:camera:added');
assert.equal(alerts('camera-a',crew,[first,added,removed,returned])[0].id,'work:job-1:camera:returned');
assert.equal(alerts('camera-b',{...crew,stage:'Editing'},[first,added]).length,0);

const editing=makeEditingJobs(crew,[{name:'Clip one',driveLink:'https://drive.google.com/one'},{name:'Clip two',driveLink:'https://drive.google.com/two'}],{id:'camera-b',name:'Second cameraman',email:'camera-b@example.test'},'2026-10-17T10:00:00.000Z');
assert.equal(editing.length,2);for(const job of editing){assert.equal(job.stage,'Editing');assert.deepEqual(assignmentIds(job,'camera'),['camera-a','camera-b']);}
assert.equal(editing[1].editorAssignee,'');assert(matchesJobFilters(editing[0],'Editing','editor-a'));assert(!matchesJobFilters(editing[0],'Editing','camera-b'));
console.log('PASS: legacy assignments, multiple shoot workers, secondary-worker visibility and filters, single-worker restrictions and warnings, per-person notifications, crew changes, and shoot-to-editing handoff.');
