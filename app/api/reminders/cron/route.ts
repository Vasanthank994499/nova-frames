import {runReminders} from '../../../../lib/reminders';
import {safelyDispatchPush} from '../../../../lib/web-push';
import {syncDueInstagram} from '../../../../lib/instagram';
export const dynamic='force-dynamic';
// Hourly: client reminders (email / WhatsApp) plus team phone pushes. Vercel Cron sends "Authorization: Bearer $CRON_SECRET".
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET;if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return new Response('Unauthorized',{status:401});
 const result=await runReminders(new URL(req.url).origin);await safelyDispatchPush();const instagram=await syncDueInstagram(new URL(req.url).origin).catch(e=>({error:(e as Error).message}));return Response.json({ok:true,...result,instagram});
}
