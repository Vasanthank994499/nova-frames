import {principal,requireOrigin} from '../../../lib/auth';
import {notificationsFor} from '../../../lib/notifications';
import {getDb} from '../../../db';
import {notificationReads} from '../../../db/schema';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(req:Request){try{const user=await principal(req),items=await notificationsFor(user);return Response.json({items,unread:items.filter(item=>!item.read).length},{headers});}catch(e){return Response.json({error:(e as Error).message},{status:401,headers});}}
export async function POST(req:Request){try{requireOrigin(req);const user=await principal(req),body=await req.json();if(!Array.isArray(body.ids)||body.ids.length>100||body.ids.some((id:unknown)=>typeof id!=='string'||id.length>500))throw Error('Choose the notifications you viewed.');const requested=new Set<string>(body.ids),items=await notificationsFor(user),visible=items.filter(item=>requested.has(item.id)&&!item.read);if(visible.length)await getDb().insert(notificationReads).values(visible.map(item=>({id:user.id+':'+item.id,accountId:user.id,itemId:item.id,readAt:Date.now()}))).onConflictDoNothing();return Response.json({ok:true,read:visible.map(item=>item.id)},{headers});}catch(e){return Response.json({error:(e as Error).message},{status:400,headers});}}
