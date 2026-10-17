import sharp from 'sharp';
export const MAX_LOGO_BYTES=2*1024*1024;
export function mayEditBrandLogo(user:{admin:boolean}){return user.admin;}
export async function normalizeBrandLogo(input:Buffer){
 if(!input.length||input.length>MAX_LOGO_BYTES)throw Error('Choose a logo smaller than 2 MB.');
 const jpeg=input[0]===255&&input[1]===216&&input[2]===255,png=input.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),webp=input.toString('ascii',0,4)==='RIFF'&&input.toString('ascii',8,12)==='WEBP';
 if(!jpeg&&!png&&!webp)throw Error('Choose a JPG, PNG or WebP logo.');
 try{const image=sharp(input,{limitInputPixels:16000000,failOn:'error'}),metadata=await image.metadata();if(!['jpeg','png','webp'].includes(metadata.format||'')||!metadata.width||!metadata.height||metadata.width>8192||metadata.height>8192||(metadata.pages||1)>1)throw Error('Invalid logo.');
  // Contain the whole logo, retain transparency and strip original metadata.
  return await image.rotate().resize(512,512,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png({compressionLevel:9}).toBuffer();
 }catch{throw Error('This logo could not be read. Choose a standard JPG, PNG or WebP image.');}
}
