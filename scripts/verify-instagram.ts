// Self-check: token sealing round-trip, wrong key fails, stats merge Meta snapshots.
import assert from 'node:assert';
import {sealToken,openToken} from '../lib/instagram';
import {instagramStats} from '../lib/clients';
(async()=>{
 const key=Buffer.alloc(32,7).toString('base64'),other=Buffer.alloc(32,9).toString('base64');
 const sealed=await sealToken('IGQ-secret-token',key);
 assert(!sealed.includes('IGQ-secret-token'));assert.equal(await openToken(sealed,key),'IGQ-secret-token');
 await assert.rejects(openToken(sealed,other));
 const s=instagramStats([],[{month:'2026-10-31',jobId:'snap',followers:100},{month:'2026-11-18',jobId:'snap',followers:130},{month:'2026-11',jobId:'',source:'meta',reach:50,views:200,engagement:10,partial:true},{month:'2026-11',jobId:'ig:1',kind:'REELS',postedAt:'2026-11-05T10:00:00+0000',views:90,reach:40,likes:5,comments:1,saves:1,shares:1,title:'Reel',link:'https://instagram.com/p/1'}],'2026-11');
 assert.equal(s.current?.growth,30);assert.equal(s.current?.followers,130);assert.equal(s.postedThisMonth,1);assert.equal(s.content[0].engagementRate,20);assert.equal(s.source,'meta');
 console.log('instagram self-check ok');

 const g=instagramStats([],[{month:'2026-11-02',jobId:'snap',followers:100,mediaCount:40},{month:'2026-11-18',jobId:'snap',followers:130,mediaCount:44}],'2026-11');
 assert.equal(g.trackingSince,'2026-11-02');assert.equal(g.overallGrowth,30);assert.equal(g.totalPosts,44);
 assert.equal(instagramStats([],[{month:'2026-11-02',jobId:'snap',followers:100}],'2026-11').overallGrowth,null);
})();
