import type {Photo} from '../storage/db';
export async function contactSheets(photos:Photo[],read:(photo:Photo)=>Promise<Blob>):Promise<Blob[]>{
 if(!photos.length||photos.length>9)throw new Error('Choose one to nine references');
 const output:Blob[]=[];
 for(let start=0;start<photos.length;start+=6){const canvas=document.createElement('canvas');canvas.width=1500;canvas.height=1100;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
 try{ctx.fillStyle='#f4f1fc';ctx.fillRect(0,0,1500,1100);ctx.fillStyle='#14101f';ctx.font='bold 28px sans-serif';ctx.fillText('Akutoo · local reference sheet',30,40);
 for(let i=start;i<Math.min(start+6,photos.length);i++){const p=photos[i];if(!Number.isFinite(p.width)||!Number.isFinite(p.height)||p.width<=0||p.height<=0||p.width*p.height>24000000)throw new Error('Reference too large');const blob=await read(p);if(blob.size>50*1024*1024)throw new Error('Reference too large');const bitmap=await createImageBitmap(blob);try{if(bitmap.width!==p.width||bitmap.height!==p.height)throw new Error('Photo dimensions changed');const cell=i-start,x=30+(cell%3)*490,y=70+Math.floor(cell/3)*510,scale=Math.min(470/bitmap.width,450/bitmap.height);ctx.fillStyle='#14101f';ctx.fillRect(x,y,470,450);ctx.drawImage(bitmap,x+(470-bitmap.width*scale)/2,y+(450-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale);ctx.fillStyle='#14101f';ctx.font='22px sans-serif';ctx.fillText(`Reference ${i+1} · ${p.body?'body '+p.body.mode:p.hair?'hair '+p.hair.style:p.detail?'face detail':'face'}`,x,y+480);}finally{bitmap.close();}}
 output.push(await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Contact sheet failed')),'image/jpeg',.92)));
 }finally{canvas.width=0;canvas.height=0;}}
 return output;
}
