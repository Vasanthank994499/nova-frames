import assert from 'node:assert/strict';
import {indiaDay,allocationDate,workAvailable,workOverdue} from '../lib/allocation-dates';
assert.equal(indiaDay(Date.parse('2026-10-22T18:29:59Z')),'2026-10-22');
assert.equal(indiaDay(Date.parse('2026-10-22T18:30:00Z')),'2026-10-23');
for(const [stage,role] of Object.entries({Content:'content',Shoot:'camera',Editing:'editor','Ready to post':'publisher',Posted:'publisher'})){
 const task={stage,allocationDates:{[role]:'2026-10-23'}};
 assert.equal(workAvailable(task,'2026-10-22'),false);assert.equal(workAvailable(task,'2026-10-23'),true);
 assert.equal(workOverdue(task,'2026-10-23'),false);assert.equal(workOverdue(task,'2026-10-24'),true);
 assert.equal(workOverdue({...task,stage:'Completed'},'2026-10-24'),false);
}
const extra={workerId:'worker',allocationDate:'2026-10-23',status:'Assigned'};
assert.equal(workAvailable(extra,'2026-10-22'),false);assert.equal(workOverdue(extra,'2026-10-24'),true);
assert.equal(workOverdue({...extra,status:'Completed'},'2026-10-24'),false);
assert.equal(workOverdue({stage:'Client approval',allocationDates:{editor:'2026-10-22'}},'2026-10-24'),false);
assert.equal(workAvailable({stage:'Content'},'2026-10-23'),true);assert.equal(workOverdue({stage:'Content'},'2026-10-23'),false);
for(const day of ['2026-02-30','2026-13-01','not-a-date'])assert.throws(()=>allocationDate(day));
console.log('PASS: IST midnight, scheduled visibility, overdue dates, completed work, client review and legacy tasks.');
