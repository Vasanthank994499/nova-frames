import sharp from 'sharp';
export const MAX_PHOTO_BYTES=2*1024*1024;
export function mayEditProfilePhoto(user:{id:string,admin:boolean},workerId:string){return user.admin||user.id===workerId;}
export function mayViewProfilePhoto(user:{id:string,admin:boolean,roles:string[]},workerId:string){return mayEditProfilePhoto(user,workerId)||user.roles.includes('manager');}
export async function normalizeProfilePhoto(input:Buffer){
 if(!input.length||input.length>MAX_PHOTO_BYTES)throw Error('Choose a photo smaller than 2 MB.');
 const jpeg=input[0]===0xff&&input[1]===0xd8&&input[2]===0xff;
 const png=input.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const webp=input.toString('ascii',0,4)==='RIFF'&&input.toString('ascii',8,12)==='WEBP';
 if(!jpeg&&!png&&!webp)throw Error('Choose a JPG, PNG or WebP photo.');
 try{
  const image=sharp(input,{limitInputPixels:16000000,failOn:'error'}),metadata=await image.metadata();
  if(!['jpeg','png','webp'].includes(metadata.format||'')||!metadata.width||!metadata.height||metadata.width>8192||metadata.height>8192||(metadata.pages||1)>1)throw Error('Invalid photo.');
  // Re-encoding strips EXIF/location metadata and never serves the original upload.
  return await image.rotate().resize(256,256,{fit:'cover',position:'centre'}).flatten({background:'#ffffff'}).jpeg({quality:84,mozjpeg:true}).toBuffer();
 }catch{throw Error('This photo could not be read. Choose a standard JPG, PNG or WebP image.');}
}
