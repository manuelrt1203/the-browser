// Isolated Redis only. No Telegram API call, file upload or production mutation.
import test from 'node:test';import assert from 'node:assert/strict';import{spawn,execFile as callback}from'node:child_process';import{promisify}from'node:util';import{once}from'node:events';import{mkdtemp,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';
import{telegramFreeService,FreeBotFailure}from'../src/lib/telegram-free.ts';
import{publicationsForTitle}from'../src/lib/catalogue-links.ts';
const execFile=promisify(callback),source='-1004339801492',owner=12345,user=54321;
const env={VERCEL:'1',VERCEL_ENV:'production',TELEGRAM_FREE_GATE_ENABLED:'1',TELEGRAM_CHANNEL_ID:source,TELEGRAM_PREMIUM_CHANNEL_ID:'-1003958043288'};
const filename='Fixture.S01E01.mp4',fileId='AgAC_private_fixture_file_123456';
const rawPost={messageId:10,version:100,updateId:1,text:filename,fileName:filename,titles:[{kind:'serie',id:999999,season:1,episode:1}],pending:[]};
const message=(id,text,actor=user)=>({update_id:id,message:{message_id:id,from:{id:actor,is_bot:false},chat:{id:actor,type:'private'},text}});
const fileMessage=(id=80)=>({message_id:id,chat:{id:owner,type:'private'},video:{file_id:fileId,file_unique_id:'unique_fixture',file_name:filename}});
const admin=(id,text='/publiergratuit',file=fileMessage())=>{const u=message(id,text,owner);u.message.reply_to_message=file;return u;};
const cb=(id,data,actor=user)=>({update_id:id,callback_query:{id:`cb${id}`,from:{id:actor,is_bot:false},message:{chat:{id:actor,type:'private'}},data}});

test('Accès gratuit : état durable, identité/membre réel, publication privée et remplacement confirmé',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'telegram-free-')),socket=join(dir,'redis.sock');
 const server=spawn(process.env.REDIS_TEST_SERVER,['--port','0','--unixsocket',socket,'--save','','--appendonly','no','--dir',dir],{stdio:'ignore'});
 const redis=async args=>JSON.parse((await execFile(process.env.REDIS_TEST_CLI,['-s',socket,'-2','--json',...args.map(String)])).stdout);
 let sent=[],members={},ownerRole='creator',mode='',n=1000;const prefix=`the-browser:{telegram-free:${source}}:`;
 const bot=async(method,body)=>{
  if(method==='getChat')return{id:Number(source),type:'channel',username:'TheBrowser365',has_protected_content:true};
  if(method==='getChatMember'){if(mode==='membership-error')throw new Error('upstream');return{status:body.user_id===owner?ownerRole:members[body.user_id]??'left',is_member:mode==='restricted-joined'};}
  sent.push({method,body});
  if(mode==='uncertain'&&['sendPhoto','editMessageMedia'].includes(method))throw new FreeBotFailure('uncertain');
  if(mode==='rejected'&&['sendPhoto','editMessageMedia'].includes(method))throw new FreeBotFailure('rejected');
  return{message_id:method==='editMessageMedia'?body.message_id:++n,date:1795600000,edit_date:method==='editMessageMedia'?1795600001:undefined,chat:{id:body.chat_id},...(['sendPhoto','editMessageMedia'].includes(method)?{photo:[{}]}:{})};
 };
 const service=telegramFreeService({redis,bot,catalogue:async()=>({posts:{[`${source}:10`]:rawPost}}),resolve:async()=>({titles:rawPost.titles,pending:[],review:[],ignored:[]}),poster:async()=> 'https://image.tmdb.org/t/p/w780/fixture.jpg'},env);
 const reset=async()=>{await redis(['FLUSHDB']);sent=[];members={};ownerRole='creator';mode='';};
 const draft=async()=>{const result=await service.command(admin(1));return result.reply.reply_markup.inline_keyboard[0][0].callback_data.split('free_publish_')[1];};
 const publish=async token=>{const r=await service.command(cb(2,`free_publish_${token}`,owner));if(r.work)await r.work();};
 try{
  for(let i=0;i<100;i++){try{if(await redis(['PING'])==='PONG')break;}catch{}await new Promise(r=>setTimeout(r,20));}
  await t.test('mode fermé, autres commandes et faux acteurs ne font rien',async()=>{
   await reset();assert.equal(await telegramFreeService({redis,bot},{...env,TELEGRAM_FREE_GATE_ENABLED:'0'}).command(message(1,'/start free_post_10')),null);
   assert.equal(await service.command(message(1,'/start premium_live_abc')),null);assert.equal(await service.command(message(1,'/copier Avatar')),null);
   const group=message(1,'/start free_post_10');group.message.chat.type='group';assert.equal(await service.command(group),null);
   const forged=message(1,'/start free_post_10');forged.message.from.id=999;assert.equal(await service.command(forged),null);assert.deepEqual(sent,[]);
  });
  await t.test('non-membre : seulement rejoindre/vérifier ; un lien ancien n’envoie pas de vidéo publique protégée',async()=>{
   await reset();const r=await service.command(message(1,'/start free_post_10'));assert.match(r.reply.text,/Rejoignez gratuitement/);assert.equal(r.reply.reply_markup.inline_keyboard[0][0].url,'https://t.me/TheBrowser365');assert.equal(r.reply.reply_markup.inline_keyboard[1][0].callback_data,'free_get_post_10');assert.deepEqual(sent,[]);
   members[user]='member';await service.command(cb(2,'free_get_post_10'));assert.equal(sent[0].method,'sendMessage');assert.equal(sent[0].body.reply_markup.inline_keyboard[0][0].url,'https://t.me/TheBrowser365/10');assert.ok(sent.every(v=>!['copyMessage','forwardMessage','sendVideo','sendDocument'].includes(v.method)));
  });
  await t.test('aide publique sans commandes administratives et vérification non-membre acquittée',async()=>{
   await reset();const guest=await service.command(message(1,'/gratuit'));assert.ok(!guest.reply.text.includes('/publiergratuit'));const adminHelp=await service.command(message(2,'/gratuit',owner));assert.match(adminHelp.reply.text,/publiergratuit/);
   const stillLeft=await service.command(cb(3,'free_get_post_10'));assert.equal(stillLeft.reply.method,'answerCallbackQuery');assert.match(stillLeft.reply.text,/Rejoignez/);assert.deepEqual(sent,[]);
  });
  await t.test('une autre publication, un canal Premium et un statut inconnu ne donnent pas de fichier',async()=>{
   await reset();members[user]='unknown';assert.match((await service.command(message(1,'/start free_post_999'))).reply.text,/pas disponible/);assert.match((await service.command(message(2,'/start free_post_10'))).reply.text,/Rejoignez/);assert.deepEqual(sent,[]);
   mode='membership-error';await assert.rejects(service.command(message(3,'/start free_post_10')));assert.deepEqual(sent,[]);
  });
  await t.test('publication réservée au propriétaire, original privé, confirmation obligatoire',async()=>{
   await reset();assert.match((await service.command({...admin(1),message:{...admin(1).message,from:{id:user},chat:{id:user,type:'private'}}})).reply.text,/propriétaire/);
   const foreign=fileMessage();foreign.forward_origin={type:'channel',chat:{id:-1003958043288},message_id:10};assert.match((await service.command(admin(2,'/publiergratuit',foreign))).reply.text,/autre canal/);
   const a=await Promise.all([service.command(admin(3)),service.command(admin(4))]);const tokens=a.map(r=>r.reply.reply_markup.inline_keyboard[0][0].callback_data);assert.equal(tokens[0],tokens[1]);assert.deepEqual(sent,[]);assert.equal((await redis(['KEYS',prefix+'asset:*'])).length,1);
   const token=tokens[0].slice('free_publish_'.length);await service.command(cb(5,`free_publish_${token}`,user));assert.deepEqual(sent,[]);
   ownerRole='administrator';const r=await service.command(cb(6,`free_publish_${token}`,owner));assert.equal(r.work,undefined);assert.deepEqual(sent,[]);
  });
  await t.test('publier : affiche seule, bouton opaque, manifeste sans file_id et une seule publication',async()=>{
   await reset();const token=await draft();await Promise.all([publish(token),publish(token)]);
   assert.equal(sent.filter(v=>v.method==='sendPhoto').length,1);assert.ok(!sent.some(v=>['sendVideo','sendDocument','deleteMessage','forwardMessage','copyMessage'].includes(v.method)));
   const posted=sent.find(v=>v.method==='sendPhoto');assert.equal(posted.body.chat_id,source);assert.equal(posted.body.reply_markup.inline_keyboard[0][0].url,`https://t.me/Thebrowser365_bot?start=free_${token}`);
   const posts=await service.publicPosts();assert.equal(Object.keys(posts).length,1);assert.ok(!JSON.stringify(posts).includes(fileId));assert.ok(!JSON.stringify(posts).includes('fileId'));
   assert.equal(publicationsForTitle('serie-999999',posts,source)[0].protectedFile,true);
  });
  await t.test('fichier privé : membre actuel obligatoire et doublon webhook ignoré',async()=>{
   await reset();const token=await draft();await publish(token);sent=[];
   assert.match((await service.command(message(10,`/start free_${token}`))).reply.text,/Rejoignez/);assert.deepEqual(sent,[]);
   members[user]='member';await service.command(cb(11,`free_get_${token}`));await service.command(cb(11,`free_get_${token}`));assert.equal(sent.length,1);assert.equal(sent[0].method,'sendVideo');assert.equal(sent[0].body.video,fileId);assert.equal(sent[0].body.chat_id,user);assert.equal(sent[0].body.protect_content,undefined);
   members[user]='left';assert.match((await service.command(cb(12,`free_get_${token}`))).reply.text,/Rejoignez/);assert.equal(sent.length,1);
  });
  await t.test('membre restreint : is_member doit être vrai ; administrateur et créateur admis',async()=>{
   await reset();const token=await draft();await publish(token);sent=[];members[user]='restricted';assert.match((await service.command(message(10,`/start free_${token}`))).reply.text,/Rejoignez/);
   mode='restricted-joined';await service.command(message(11,`/start free_${token}`));members[user]='administrator';await service.command(message(12,`/start free_${token}`));assert.equal(sent.filter(v=>v.method==='sendVideo').length,2);
  });
  await t.test('remplacer : fichier sauvegardé avant édition et ancien ID conservé, jamais de suppression',async()=>{
   await reset();const r=await service.command(admin(1,'/protegergratuit https://t.me/TheBrowser365/10'));assert.match(r.reply.text,/retiré de ce message/);const token=r.reply.reply_markup.inline_keyboard[0][0].callback_data.slice('free_publish_'.length);
   assert.equal(JSON.parse(await redis(['GET',prefix+'asset:'+token])).fileId,fileId);assert.deepEqual(sent,[]);await publish(token);
   const edit=sent.find(v=>v.method==='editMessageMedia');assert.equal(edit.body.message_id,10);assert.equal(edit.body.chat_id,source);assert.equal(edit.body.media.type,'photo');assert.ok(!sent.some(v=>v.method==='deleteMessage'));assert.equal((await service.publicPosts())[`${source}:10`].freeAccessToken,token);members[user]='member';sent=[];await service.command(message(10,'/start free_post_10'));assert.equal(sent[0].method,'sendVideo');
  });
  await t.test('remplacement incorrect refusé ; brouillon annulé et course annulation/publication sûrs',async()=>{
   await reset();assert.match((await service.command(admin(1,'/protegergratuit https://t.me/TheBrowser365/999'))).reply.text,/Aucun message/);
   const token=await draft();await service.command(cb(3,`free_cancel_${token}`,owner));await publish(token);assert.ok(!sent.some(v=>v.method==='sendPhoto'));
   await reset();const another=await draft();await Promise.all([publish(another),service.command(cb(3,`free_cancel_${another}`,owner))]);const state=JSON.parse(await redis(['GET',prefix+'asset:'+another]));assert.ok(['published','cancelled'].includes(state.status));assert.equal(sent.filter(v=>v.method==='sendPhoto').length,state.status==='published'?1:0);
  });
  await t.test('désactivation ferme la livraison ; erreur ambiguë ne republie jamais',async()=>{
   await reset();const token=await draft();await publish(token);await service.command(cb(3,`free_disable_${token}`,owner));members[user]='member';sent=[];assert.match((await service.command(message(4,`/start free_${token}`))).reply.text,/pas disponible/);assert.deepEqual(sent,[]);assert.deepEqual(await service.publicPosts(),{});
   await reset();const uncertain=await draft();mode='uncertain';await publish(uncertain);await publish(uncertain);assert.equal(sent.filter(v=>v.method==='sendPhoto').length,1);assert.equal(JSON.parse(await redis(['GET',prefix+'asset:'+uncertain])).status,'uncertain');assert.deepEqual(await service.publicPosts(),{});
  });
  await t.test('rejet explicite : brouillon conservé et nouvelle confirmation possible, jamais de retry automatique',async()=>{
   await reset();const token=await draft();mode='rejected';await publish(token);assert.equal(JSON.parse(await redis(['GET',prefix+'asset:'+token])).status,'draft');assert.equal(sent.filter(v=>v.method==='sendPhoto').length,1);assert.deepEqual(await service.publicPosts(),{});
   mode='';await publish(token);assert.equal(JSON.parse(await redis(['GET',prefix+'asset:'+token])).status,'published');
  });
  await t.test('limites et panne Redis ne livrent pas un fichier sans contrôle',async()=>{
   await reset();members[user]='member';for(let i=0;i<12;i++)await service.command(message(100+i,'/start free_post_10'));assert.match((await service.command(message(113,'/start free_post_10'))).reply.text,/Patientez/);assert.equal(sent.length,12);
   const failed=telegramFreeService({bot,redis:async()=>{throw new Error('down');},catalogue:async()=>({posts:{[`${source}:10`]:rawPost}})},env);await assert.rejects(failed.command(message(114,'/start free_post_10')));
  });
 }finally{if(server.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}await rm(dir,{recursive:true,force:true});}
});
