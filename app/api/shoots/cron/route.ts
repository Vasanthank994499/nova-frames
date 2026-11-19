import {safelyDispatchPush} from '../../../../lib/web-push';
export const dynamic='force-dynamic';
// Sends due shoot reminders (and any other undelivered alerts) to phones. Call hourly from Vercel Cron with CRON_SECRET.
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET;if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return new Response('Unauthorized',{status:401});
 await safelyDispatchPush();return Response.json({ok:true});
}
