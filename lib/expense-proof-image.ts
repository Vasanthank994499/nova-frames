import sharp from 'sharp';

export const MAX_EXPENSE_PROOF_BYTES=6*1024*1024;

export async function normalizeExpenseProof(input:Buffer){
 if(!input.length||input.length>MAX_EXPENSE_PROOF_BYTES)throw Error('Choose a photo smaller than 6 MB.');
 try{
  const image=sharp(input,{limitInputPixels:24000000,failOn:'error',animated:false}),metadata=await image.metadata();
  if(!['jpeg','png','webp'].includes(metadata.format||'')||!metadata.width||!metadata.height||metadata.width>10000||metadata.height>10000||(metadata.pages||1)>1)throw Error('Choose a valid JPG, PNG or WebP receipt photo.');
  const resized=image.rotate().resize(1440,1440,{fit:'inside',withoutEnlargement:true});
  let output=await resized.clone().webp({quality:76,effort:4}).toBuffer();
  if(output.length>900*1024)output=await resized.clone().webp({quality:62,effort:5}).toBuffer();
  if(output.length>1200*1024)throw Error('This receipt photo is too detailed. Choose a smaller image.');
  return output;
 }catch(error){
  if(error instanceof Error&&error.message.startsWith('Choose a valid'))throw error;
  if(error instanceof Error&&error.message.startsWith('This receipt'))throw error;
  throw Error('Choose a valid JPG, PNG or WebP receipt photo.');
 }
}
