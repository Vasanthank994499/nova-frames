import {sql,eq} from 'drizzle-orm';
import {getDb} from '../db';
import {workers} from '../db/schema';
import {principal,requireOrigin} from './auth';
import {mayEditProfilePhoto,mayViewProfilePhoto,normalizeProfilePhoto,MAX_PHOTO_BYTES} from './profile-photo-image';
let ready:Promise<void>|undefined;
export function ensurePhotoStorage(){return ready??=getDb().execute(sql`CREATE TABLE IF NOT EXISTS worker_profile_photos(worker_id text PRIMARY KEY,image_base64 text NOT NULL,version text NOT NULL,updated_at bigint NOT NULL,updated_by text NOT NULL)`).then(()=>{}).catch(error=>{ready=undefined;throw error;});}
export async function profilePhotoVersions(ids:string[]){await ensurePhotoStorage();if(!ids.length)return {} as Record<string,string>;const rows=await getDb().execute(sql`SELECT worker_id,version FROM worker_profile_photos WHERE worker_id IN (${sql.join([...new Set(ids)].map(id=>sql`${id}`),sql`,`)})`);return Object.fromEntries(rows.rows.map(row=>[String(row.worker_id),String(row.version)])) as Record<string,string>;}
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function getProfilePhoto(req:Request){
 let user;try{user=await principal(req);}catch{return new Response(null,{status:401,headers});}
 const workerId=new URL(req.url).searchParams.get('photo')||user.id;if(!mayViewProfilePhoto(user,workerId))return new Response(null,{status:403,headers});
 try{const db=getDb(),worker=await db.select().from(workers).where(eq(workers.id,workerId)).then(rows=>rows[0]);if(!worker||worker.removed||(!worker.active&&!user.admin))return new Response(null,{status:404,headers});await ensurePhotoStorage();const row=(await db.execute(sql`SELECT image_base64 FROM worker_profile_photos WHERE worker_id=${workerId}`)).rows[0];if(!row)return new Response(null,{status:404,headers});return new Response(new Uint8Array(Buffer.from(String(row.image_base64),'base64')),{headers:{...headers,'Content-Type':'image/jpeg','Content-Disposition':'inline; filename="profile.jpg"','Cross-Origin-Resource-Policy':'same-origin'}});
 }catch{return new Response(null,{status:500,headers});}
}
export async function updateProfilePhoto(req:Request){
 let user;try{requireOrigin(req);user=await principal(req);}catch{return Response.json({error:'Please sign in to change a profile photo.'},{status:401,headers});}
 const workerId=new URL(req.url).searchParams.get('photo')||user.id;if(!mayEditProfilePhoto(user,workerId))return Response.json({error:'You can change only your own photo. Only administrators can change another person’s photo.'},{status:403,headers});
 if(!req.headers.get('content-type')?.startsWith('multipart/form-data'))return Response.json({error:'Choose an image file.'},{status:400,headers});
 if(Number(req.headers.get('content-length')||0)>MAX_PHOTO_BYTES+16384)return Response.json({error:'Choose a photo smaller than 2 MB.'},{status:413,headers});
 try{
  const db=getDb(),worker=await db.select().from(workers).where(eq(workers.id,workerId)).then(rows=>rows[0]);if(!worker||worker.removed||(!worker.active&&!user.admin))return Response.json({error:'Worker not found.'},{status:404,headers});
  const form=await req.formData(),file=form.get('photo');if(!(file instanceof File)||!['image/jpeg','image/png','image/webp'].includes(file.type))return Response.json({error:'Choose a JPG, PNG or WebP photo.'},{status:400,headers});if(!file.size||file.size>MAX_PHOTO_BYTES)return Response.json({error:'Choose a photo smaller than 2 MB.'},{status:413,headers});
  let image:Buffer;try{image=await normalizeProfilePhoto(Buffer.from(await file.arrayBuffer()));}catch(error){return Response.json({error:(error as Error).message},{status:400,headers});}
  await ensurePhotoStorage();const version=crypto.randomUUID();
  // The guard is checked again in the write so disabling/removing a worker during upload cannot bypass it.
  const saved=await db.execute(sql`INSERT INTO worker_profile_photos(worker_id,image_base64,version,updated_at,updated_by) SELECT id,${image.toString('base64')},${version},${Date.now()},${user.id} FROM workers WHERE id=${workerId} AND removed=0 AND (active=1 OR ${user.admin}) ON CONFLICT(worker_id) DO UPDATE SET image_base64=EXCLUDED.image_base64,version=EXCLUDED.version,updated_at=EXCLUDED.updated_at,updated_by=EXCLUDED.updated_by RETURNING worker_id`);
  if(!saved.rows.length)return Response.json({error:'This worker account changed. Refresh and try again.'},{status:409,headers});
  return Response.json({ok:true,version},{headers});
 }catch{console.error('Profile photo could not be saved.');return Response.json({error:'Could not save the photo. Please try again.'},{status:500,headers});}
}
