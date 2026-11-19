// Explicit operator action only. Dry-run by default; never called by the webhook.
import { readChannelState } from '../src/lib/telegram-store.ts';
import { premiumRedisCommand as redis } from '../src/lib/premium-redis.ts';

const args=process.argv.slice(2),apply=args.includes('--apply');
const id=Number(args.find(arg=>/^\d+$/.test(arg)));
const source=process.env.TELEGRAM_CHANNEL_ID,target=process.env.TELEGRAM_PREMIUM_CHANNEL_ID;
const token=process.env.TELEGRAM_BOT_TOKEN;
if(!Number.isSafeInteger(id)||id<1||!token||!/^\-100\d+$/.test(source??'')||!/^\-100\d+$/.test(target??'')||source===target)throw new Error('Série, bot et deux canaux distincts requis.');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function telegram(method,data){
 for(let attempt=0;attempt<4;attempt++){
  let response,body;
  try{
   response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),redirect:'error',signal:AbortSignal.timeout(50000)});
   body=await response.json();
  }catch{throw new Error('Réponse Telegram incertaine : arrêt sans nouvelle copie automatique.');}
  if(body.ok)return body.result;
  // A rejected rate-limited request did not send the message. Other errors are
  // never retried: copyMessage offers no provider idempotency key.
  const retry=body.parameters?.retry_after;
  if(response.status===429&&Number.isInteger(retry)&&retry>=1&&retry<=60&&attempt<3){await pause(retry*1000+200);continue;}
  throw new Error(`Telegram HTTP${response.status} code${Number.isInteger(body.error_code)?body.error_code:0} : copie arrêtée.`);
 }
}

try{
 const me=await telegram('getMe',{});
 if(me.username?.toLowerCase()!=='thebrowser365_bot')throw new Error('Bot inattendu.');
 for(const channel of [source,target]){
  const chat=await telegram('getChat',{chat_id:channel});
  const member=await telegram('getChatMember',{chat_id:channel,user_id:me.id});
  if(String(chat.id)!==channel||chat.type!=='channel'||member.status!=='administrator'||(channel===target&&!member.can_post_messages)||(channel===source&&chat.has_protected_content))throw new Error('Accès au canal ou permission de copie insuffisants.');
 }
 const state=await readChannelState();
 const episode=p=>p.titles.find(t=>t.kind==='serie'&&t.id===id);
 const posts=Object.values(state.posts).filter(p=>episode(p)&&/\.(mp4|mkv|avi|mov|webm)$/i.test(p.fileName??''))
  .sort((a,b)=>(episode(a).season??999)-(episode(b).season??999)||(episode(a).episode??999)-(episode(b).episode??999)||a.messageId-b.messageId);
 if(!posts.length)throw new Error('Aucune vidéo identifiée pour cette série.');
 const plan=posts.map(p=>({sourceMessageId:p.messageId,season:episode(p).season,episode:episode(p).episode}));
 console.log(JSON.stringify({mode:apply?'copy':'dry-run',seriesId:id,source,target,count:plan.length,plan:apply?undefined:plan}));
 if(!apply)process.exit(0);
 let posterMessageId=null;
 if(args.includes('--poster')){
  const key=`the-browser:telegram-copy:${source}:${target}:poster:tv:${id}`;
  const existing=await redis(['GET',key]);
  if(existing){const saved=JSON.parse(existing);if(saved.status!=='copied'||!Number.isSafeInteger(saved.targetMessageId)||saved.targetMessageId<1)throw new Error('Affiche à rapprocher avant reprise.');posterMessageId=saved.targetMessageId;}
  else{
   const response=await fetch(`https://api.themoviedb.org/3/tv/${id}?language=fr-FR`,{headers:{Authorization:`Bearer ${process.env.TMDB_READ_TOKEN??''}`},redirect:'error',signal:AbortSignal.timeout(20000)});
   const detail=await response.json();
   if(!response.ok||detail.id!==id||!/^\/[A-Za-z0-9_.-]+$/.test(detail.poster_path??'')||typeof detail.name!=='string')throw new Error('Affiche TMDB indisponible.');
   const record={seriesId:id,source,target,status:'sending',startedAt:new Date().toISOString()};
   if(await redis(['SET',key,JSON.stringify(record),'NX'])!=='OK')throw new Error('Une autre copie de l’affiche est en cours.');
   const seasons=new Set(plan.map(item=>item.season).filter(Number.isInteger));
   const result=await telegram('sendPhoto',{chat_id:target,photo:`https://image.tmdb.org/t/p/w780${detail.poster_path}`,caption:`${detail.name}\n${seasons.size} saisons · ${plan.length} épisodes\n\nAffiche : TMDB`,disable_notification:true});
   if(!Number.isSafeInteger(result.message_id))throw new Error('Affiche envoyée : vérifier le canal avant reprise.');
   posterMessageId=result.message_id;
   await redis(['SET',key,JSON.stringify({...record,status:'copied',targetMessageId:posterMessageId,completedAt:new Date().toISOString()})]);
   console.log(JSON.stringify({posterPublished:true,posterMessageId}));
   await pause(1200);
  }
 }
 let copied=0,alreadyCopied=0,firstMessage=null,lastMessage=null;
 for(const item of plan){
  const key=`the-browser:telegram-copy:${source}:${target}:${item.sourceMessageId}`;
  const existing=await redis(['GET',key]);
  if(existing){const saved=JSON.parse(existing);if(saved.status==='copied'&&Number.isSafeInteger(saved.targetMessageId)&&saved.targetMessageId>0){alreadyCopied++;continue;}throw new Error(`Copie ${item.sourceMessageId} à rapprocher avec son identifiant Premium avant reprise.`);}
  // A durable reservation prevents concurrent copies and blind retries after
  // an ambiguous API response. It is deliberately not expired or cleared.
  const record={...item,seriesId:id,source,target,status:'sending',startedAt:new Date().toISOString()};
  if(await redis(['SET',key,JSON.stringify(record),'NX'])!=='OK')throw new Error('Une autre copie est en cours.');
  const result=await telegram('copyMessage',{chat_id:target,from_chat_id:source,message_id:item.sourceMessageId,disable_notification:true});
  if(!Number.isSafeInteger(result.message_id)||result.message_id<1)throw new Error('Identifiant de copie invalide ; vérifier le canal avant reprise.');
  await redis(['SET',key,JSON.stringify({...record,status:'copied',targetMessageId:result.message_id,completedAt:new Date().toISOString()})]);
  copied++;firstMessage??=result.message_id;lastMessage=result.message_id;
  if(copied%10===0||copied+alreadyCopied===plan.length)console.log(JSON.stringify({copied,alreadyCopied,total:plan.length,lastSeason:item.season,lastEpisode:item.episode}));
  await pause(1200);
 }
 console.log(JSON.stringify({complete:true,copied,alreadyCopied,total:plan.length,posterMessageId,firstMessage,lastMessage}));
}catch(error){
 // Never print provider errors/URLs containing the bot token.
 console.error(error instanceof Error&&!error.message.includes(token)?error.message:'Copie interrompue ; consulter le registre avant toute reprise.');
 process.exitCode=1;
}
