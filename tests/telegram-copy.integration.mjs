import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFile as callback} from 'node:child_process';
import {promisify} from 'node:util';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {telegramCopyService,TelegramCopyRateLimit} from '../src/lib/telegram-copy.ts';
const execFile=promisify(callback);
const env={VERCEL:'1',VERCEL_ENV:'production',TELEGRAM_COPY_ENABLED:'1',TELEGRAM_CHANNEL_ID:'-1001111111111',TELEGRAM_PREMIUM_CHANNEL_ID:'-1002222222222',TELEGRAM_COPY_ADMIN_IDS:'4'};
const entry=(messageId,episode)=>({messageId,version:1,updateId:1,text:'Chris',fileName:`Chris S01E0${episode}.mp4`,pending:[],titles:[{kind:'serie',id:252,expectedTitle:'Everybody Hates Chris',season:1,episode}]});
test('commandes et worker : Redis réel isolé, autorisations, reprises et absence de doubles copies',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'telegram-copy-')),socket=join(dir,'redis.sock');
 const server=spawn(process.env.REDIS_TEST_SERVER,['--port','0','--unixsocket',socket,'--save','','--appendonly','no','--dir',dir],{stdio:'ignore'});
 const redis=async args=>JSON.parse((await execFile(process.env.REDIS_TEST_CLI,['-s',socket,'-2','--json',...args.map(String)])).stdout);
 try{
  for(let i=0;i<100;i++){try{if(await redis(['PING'])==='PONG')break;}catch{}await new Promise(r=>setTimeout(r,20));}
  let clock=1000,next=100,mode='',owners=new Set([1,2]),updates=1;
  let sent=[];
  const bot=async(method,body)=>{
   if(method==='getChatMember')return {status:owners.has(body.user_id)?'creator':'administrator'};
   if(method==='copyMessage'&&mode==='uncertain'){sent.push({method,body});throw new Error('Unknown response');}
   if(method==='copyMessage'&&mode==='rate'){mode='';throw new TelegramCopyRateLimit(2);}
   sent.push({method,body});return {message_id:next++};
  };
  const service=telegramCopyService({redis,bot,catalogue:async()=>({posts:{a:entry(11,2),b:entry(10,1)}}),poster:async()=> 'https://image.tmdb.org/t/p/w780/test.jpg',now:()=>clock,pause:async ms=>{clock+=ms;}},env);
  const update=(user,text='/copier Tout le monde déteste Chris')=>({update_id:updates++,message:{chat:{id:user,type:'private'},from:{id:user,is_bot:false},text}});
  const reset=async()=>{await redis(['FLUSHDB']);sent=[];mode='';owners=new Set([1,2]);clock=1000;};
  await t.test('propriétaires et liste explicite autorisés, administrateurs ordinaires refusés',async()=>{
   assert.equal(await service.authorized(1),true);assert.equal(await service.authorized(2),true);assert.equal(await service.authorized(4),true);assert.equal(await service.authorized(3),false);
   assert.match((await service.command(update(3))).reply.text,/réservée/);
   assert.equal(await redis(['LLEN','the-browser:{telegram-copy-jobs}:queue']),0);
   const group=update(1);group.message.chat.type='group';assert.equal(await service.command(group),null);
   const forged=update(1);forged.message.chat.id=2;assert.equal(await service.command(forged),null);
  });
  await t.test('doublon webhook, concurrence et nouvelle demande ne recopient pas les vidéos',async()=>{
   await reset();const request=update(1);await service.command(request);await service.command(request);await service.command(update(2));
   assert.equal(await redis(['LLEN','the-browser:{telegram-copy-jobs}:queue']),1);
   await Promise.all([service.worker(),service.worker()]);
   assert.deepEqual(sent.filter(s=>s.method==='copyMessage').map(s=>s.body.message_id),[10,11]);
   assert.equal(sent.filter(s=>s.method==='sendPhoto').length,1);
   assert.ok(sent.filter(s=>s.method!=='sendMessage').every(s=>s.body.chat_id===env.TELEGRAM_PREMIUM_CHANNEL_ID&&s.body.disable_notification));
   await service.command(update(1));await service.worker();
   assert.equal(sent.filter(s=>s.method==='copyMessage').length,2);
   assert.match((await service.command(update(1,'/copie'))).reply.text,/0 copiées, 2 déjà présentes/);
  });
  await t.test('budget épuisé : reprise durable et affiche non renvoyée',async()=>{
   await reset();await service.command(update(1));await service.worker(1);
   assert.equal(sent.filter(s=>s.method==='copyMessage').length,0);
   await service.worker();assert.equal(sent.filter(s=>s.method==='sendPhoto').length,1);assert.equal(sent.filter(s=>s.method==='copyMessage').length,2);
  });
  await t.test('envoi ambigu : réservation conservée et aucune répétition automatique',async()=>{
   await reset();mode='uncertain';await service.command(update(1));await service.worker();mode='';
   await service.command(update(1));await service.worker();
   assert.equal(sent.filter(s=>s.method==='copyMessage').length,1);
   assert.match((await service.command(update(1,'/copie'))).reply.text,/vérifié/);
   const record=JSON.parse(await redis(['GET',`the-browser:telegram-copy:${env.TELEGRAM_CHANNEL_ID}:${env.TELEGRAM_PREMIUM_CHANNEL_ID}:10`]));assert.equal(record.status,'sending');
  });
  await t.test('429 connu sans envoi : reprise différée sans bloquer définitivement',async()=>{
   await reset();mode='rate';await service.command(update(1));await service.worker();
   assert.equal(sent.filter(s=>s.method==='copyMessage').length,0);await service.worker();assert.equal(sent.filter(s=>s.method==='copyMessage').length,0);
   clock+=3000;await service.worker();assert.equal(sent.filter(s=>s.method==='copyMessage').length,2);
  });
  await t.test('perte de propriété après la commande : aucune publication',async()=>{
   await reset();await service.command(update(1));owners.delete(1);await service.worker();
   assert.equal(sent.filter(s=>s.method==='copyMessage'||s.method==='sendPhoto').length,0);
  });
  await t.test('film : affiche movie et fichier du film, sans confusion avec une série',async()=>{
   await reset();
   const movie={...entry(30,1),titles:[{kind:'film',id:603692,expectedTitle:'John Wick : Chapitre 4',year:2023}]};
   const films=telegramCopyService({redis,bot,catalogue:async()=>({posts:{movie}}),poster:async plan=>{assert.equal(plan.kind,'film');return 'https://image.tmdb.org/t/p/w780/movie.jpg';},now:()=>clock,pause:async ms=>{clock+=ms;}},env);
   await films.command(update(1,'/copier film John Wick : Chapitre 4'));await films.worker();
   assert.deepEqual(sent.filter(s=>s.method==='copyMessage').map(s=>s.body.message_id),[30]);
   assert.equal(JSON.parse(await redis(['GET',`the-browser:telegram-copy:${env.TELEGRAM_CHANNEL_ID}:${env.TELEGRAM_PREMIUM_CHANNEL_ID}:poster:movie:603692`])).status,'copied');
  });
 }finally{if(server.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}await rm(dir,{recursive:true,force:true});}
});
