import {sql,eq} from 'drizzle-orm';
import {getDb} from '../db';
import {brands} from '../db/schema';
import {principal,requireOrigin} from './auth';
import {mayEditBrandLogo,normalizeBrandLogo,MAX_LOGO_BYTES} from './brand-logo-image';
let ready:Promise<void>|undefined;
export function ensureBrandLogoStorage(){return ready??=getDb().execute(sql`CREATE TABLE IF NOT EXISTS brand_logos(brand_id text PRIMARY KEY,image_base64 text NOT NULL,version text NOT NULL,updated_at bigint NOT NULL,updated_by text NOT NULL)`).then(()=>{}).catch(error=>{ready=undefined;throw error;});}
export async function brandLogoVersions(ids:string[]){await ensureBrandLogoStorage();if(!ids.length)return {} as Record<string,string>;const rows=await getDb().execute(sql`SELECT brand_id,version FROM brand_logos WHERE brand_id IN (${sql.join([...new Set(ids)].map(id=>sql`${id}`),sql`,`)})`);return Object.fromEntries(rows.rows.map(row=>[String(row.brand_id),String(row.version)])) as Record<string,string>;}
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function getBrandLogo(req:Request){
 let user;try{user=await principal(req);}catch{return new Response(null,{status:401,headers});}
 const id=new URL(req.url).searchParams.get('brand-logo')||'';
 try{const db=getDb(),brand=await db.select().from(brands).where(eq(brands.id,id)).then(rows=>rows[0]);if(!brand||(JSON.parse(brand.payload).active===false&&!user.admin))return new Response(null,{status:404,headers});await ensureBrandLogoStorage();const row=(await db.execute(sql`SELECT image_base64 FROM brand_logos WHERE brand_id=${id}`)).rows[0];if(!row)return new Response(null,{status:404,headers});return new Response(new Uint8Array(Buffer.from(String(row.image_base64),'base64')),{headers:{...headers,'Content-Type':'image/png','Content-Disposition':'inline; filename="brand-logo.png"','Cross-Origin-Resource-Policy':'same-origin'}});
 }catch{return new Response(null,{status:500,headers});}
}
export async function updateBrandLogo(req:Request){
 let user;try{requireOrigin(req);user=await principal(req);}catch{return Response.json({error:'Please sign in to upload a brand logo.'},{status:401,headers});}
 if(!mayEditBrandLogo(user))return Response.json({error:'Only administrators can change brand logos.'},{status:403,headers});
 const id=new URL(req.url).searchParams.get('brand-logo')||'';
 if(!req.headers.get('content-type')?.startsWith('multipart/form-data'))return Response.json({error:'Choose a logo image.'},{status:400,headers});if(Number(req.headers.get('content-length')||0)>MAX_LOGO_BYTES+16384)return Response.json({error:'Choose a logo smaller than 2 MB.'},{status:413,headers});
 try{const db=getDb(),brand=await db.select().from(brands).where(eq(brands.id,id)).then(rows=>rows[0]);if(!brand)return Response.json({error:'Brand not found.'},{status:404,headers});const form=await req.formData(),file=form.get('logo');if(!(file instanceof File)||!['image/jpeg','image/png','image/webp'].includes(file.type))return Response.json({error:'Choose a JPG, PNG or WebP logo.'},{status:400,headers});if(!file.size||file.size>MAX_LOGO_BYTES)return Response.json({error:'Choose a logo smaller than 2 MB.'},{status:413,headers});let image:Buffer;try{image=await normalizeBrandLogo(Buffer.from(await file.arrayBuffer()));}catch(error){return Response.json({error:(error as Error).message},{status:400,headers});}
  await ensureBrandLogoStorage();const version=crypto.randomUUID(),saved=await db.execute(sql`INSERT INTO brand_logos(brand_id,image_base64,version,updated_at,updated_by) SELECT id,${image.toString('base64')},${version},${Date.now()},${user.id} FROM brands WHERE id=${id} ON CONFLICT(brand_id) DO UPDATE SET image_base64=EXCLUDED.image_base64,version=EXCLUDED.version,updated_at=EXCLUDED.updated_at,updated_by=EXCLUDED.updated_by RETURNING brand_id`);if(!saved.rows.length)return Response.json({error:'This brand changed. Refresh and try again.'},{status:409,headers});return Response.json({ok:true,version},{headers});
 }catch{console.error('Brand logo could not be saved.');return Response.json({error:'Could not save the brand logo. Please try again.'},{status:500,headers});}
}
