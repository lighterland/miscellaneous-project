export function maskedMetrics(gray:ArrayLike<number>, mask:ArrayLike<number>, width:number, height:number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || gray.length !== width*height || mask.length !== gray.length) throw new Error('Invalid masked image');
  let count=0,exposure=0,bright=0,clipped=0,left=width,top=height,right=-1,bottom=-1,sum=0,squares=0,interior=0;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const i=y*width+x; if(mask[i] !== 1) continue;
    if(!Number.isFinite(gray[i])) throw new Error('Invalid target pixel');
    count++; exposure+=gray[i]; if(gray[i]>=250) bright++; if(gray[i]<=5 || gray[i]>=250) clipped++;
    left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
    if(x>0 && x<width-1 && y>0 && y<height-1 && [i-1,i+1,i-width,i+width].every(j=>mask[j]===1)) {
      const laplacian=gray[i-1]+gray[i+1]+gray[i-width]+gray[i+width]-4*gray[i]; sum+=laplacian; squares+=laplacian*laplacian; interior++;
    }
  }
  return { area:count/(width*height), bounds:count ? {x:left,y:top,width:right-left+1,height:bottom-top+1} : null,
    exposure:count ? exposure/count : null, brightClipped:count ? bright/count : null, clipped:count ? clipped/count : null,
    sharpness:interior ? Math.max(0,squares/interior-(sum/interior)**2) : null };
}
export function maskedSwatch(rgba:Uint8ClampedArray, mask:ArrayLike<number>):string|null {
  if(rgba.length !== mask.length*4) throw new Error('Invalid color mask');
  const channels:number[][]=[[],[],[]];
  for(let i=0;i<mask.length;i++) if(mask[i]===1) for(let c=0;c<3;c++) channels[c].push(rgba[i*4+c]);
  if(!channels[0].length) return null;
  return '#'+channels.map(values=>{ values.sort((a,b)=>a-b); const middle=Math.floor(values.length/2); return Math.round(values.length%2 ? values[middle] : (values[middle-1]+values[middle])/2).toString(16).padStart(2,'0'); }).join('');
}
