export type CardFormat='instagram'|'whatsapp'|'square';
export const cardSize=(format:CardFormat)=>({width:1080,height:format==='square'?1080:1920});
export function textLines(text:string,measure:(s:string)=>number,width:number,maximumLines:number):string[]{
 const tokens=text.trim().split(/\s+/).filter(Boolean),lines:string[]=[];
 let line='';
 for(const token of tokens){
  let word=token;
  if(line&&measure(line+' '+word)>width){lines.push(line);line='';}
  while(measure(word)>width&&word.length>1){let length=1;while(length<word.length&&measure(word.slice(0,length+1))<=width)length++;if(line){lines.push(line);line='';}lines.push(word.slice(0,length));word=word.slice(length);}
  line=line?line+' '+word:word;
 }
 if(line)lines.push(line);
 if(lines.length>maximumLines){lines.length=maximumLines;let last=lines[maximumLines-1];while(last&&measure(last+'…')>width)last=last.slice(0,-1);lines[maximumLines-1]=last+'…';}
 return lines;
}
type CardData={kind?:"report";name:string;update:string;reviewLabel:string;status:string;attribution:string;recordDate:string;snapshotDate:string;url:string;synthetic:boolean};
export function drawShareCard(canvas:HTMLCanvasElement,format:CardFormat,data:CardData){
 const size=cardSize(format);canvas.width=size.width;canvas.height=size.height;
 const c=canvas.getContext('2d');if(!c)throw new Error('This browser cannot draw a share image.');
 const story=format!=='square',h=size.height,left=96,width=888;
 const text=(value:string,y:number,font:number,max=2,color='#1c1917',weight='500')=>{c.fillStyle=color;c.font=weight+' '+font+'px Arial, sans-serif';textLines(value,s=>c.measureText(s).width,width,max).forEach((line,i)=>c.fillText(line,left,y+i*(font*1.22)));};
 const round=(x:number,y:number,w:number,height:number,r:number,color:string)=>{c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,height,r);c.fill();};
 const background=c.createLinearGradient(0,0,1080,h);background.addColorStop(0,'#15382e');background.addColorStop(1,'#071e1a');c.fillStyle=background;c.fillRect(0,0,1080,h);
 c.strokeStyle='rgba(215,238,219,0.10)';c.lineWidth=2;for(let i=0;i<8;i++){c.beginPath();c.arc(900,80,120+i*70,0,Math.PI*2);c.stroke();}
 const top=story?170:44;round(48,top,984,story?1530:992,36,'#f8f6ef');
 const brandY=top+65;c.fillStyle='#f59e0b';c.beginPath();c.arc(126,brandY,30,0,Math.PI*2);c.fill();c.strokeStyle='#1c1917';c.lineWidth=3;for(let j=-1;j<=1;j++){c.beginPath();for(let x=0;x<=36;x++){const y=brandY+j*9+Math.sin(x/5)*3;if(x===0)c.moveTo(108+x,y);else c.lineTo(108+x,y);}c.stroke();}
 c.fillStyle='#1c1917';c.font='bold 32px Arial, sans-serif';c.fillText('AquaRelay',172,brandY+11);c.fillStyle='#667565';c.font='20px Arial, sans-serif';c.fillText('EVERY WATER BODY HAS A HISTORY',left,top+126);
 text(data.synthetic?'SYNTHETIC DEMO · FICTIONAL RECORD':data.kind==='report'?'COMMUNITY OBSERVATION':data.status==='Resolved'?'RECOVERY RECORDED':'A WATER-BODY UPDATE',top+184,23,1,'#8b5b13','bold');
 text(data.name,top+storyOffset(story,272,240),story?70:52,story?3:2,'#183b30','bold');
 const surface=story?top+535:top+380,artHeight=story?310:175;
 round(left,surface,width,artHeight,24,'#d9e6d4');
 c.fillStyle='#f4c46b';c.beginPath();c.arc(830,surface+62,40,0,Math.PI*2);c.fill();
 c.save();c.beginPath();c.roundRect(left,surface,width,artHeight,24);c.clip();
 for(let i=0;i<4;i++){c.fillStyle=['#abcabd','#82b2aa','#4d9184','#256f62'][i];c.beginPath();c.moveTo(left,surface+80+i*40);c.bezierCurveTo(350,surface+170+i*25,590,surface+10+i*40,984,surface+100+i*44);c.lineTo(984,surface+artHeight);c.lineTo(left,surface+artHeight);c.closePath();c.fill();}c.restore();
 text(data.update,story?top+920:top+615,story?39:30,story?4:2,'#183b30');
 const reviewY=story?top+1180:top+740;
 text(data.reviewLabel,reviewY,story?26:22,2,'#79571f','bold');
 text('Status: '+data.status,reviewY+storyOffset(story,86,65),25,1,'#183b30');
 const foot=story?top+1330:top+845;
 text(data.recordDate?'Recorded '+data.recordDate:'Snapshot '+data.snapshotDate,foot,21,1,'#657368');
 text('Source: '+data.attribution,foot+38,19,2,'#657368');
 text(data.url,foot+110,21,1,'#183b30','bold');
 text('View the live record for evidence and updates',foot+143,18,1,'#657368');
}
const storyOffset=(story:boolean,portrait:number,square:number)=>story?portrait:square;
