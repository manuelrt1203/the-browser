import test from 'node:test';
import assert from 'node:assert/strict';
import {copyCommand,findCopyPlans} from '../src/lib/telegram-copy-plan.ts';

const post=(messageId,kind,id,title,season,episode,year)=>({messageId,version:1,updateId:1,text:title,fileName:`video${messageId}.mp4`,pending:[],titles:[{kind,id,expectedTitle:title,verifiedNames:[title],season,episode,year}]});
test('copier : commandes privées françaises, mention du bot, statut et destination fixe',()=>{
 assert.deepEqual(copyCommand('/copier@Thebrowser365_bot série Tout le monde déteste Chris vers le canal Premium'),{status:false,query:'série Tout le monde déteste Chris'});
 assert.deepEqual(copyCommand('copier film Avatar'),{status:false,query:'film Avatar'});
 assert.equal(copyCommand('/copie').status,true);assert.equal(copyCommand('/start premium_live_token'),null);
 assert.equal(copyCommand('/copier@OtherBot Avatar'),null);
});
test('copier : ambiguïtés conservées, type/année/id exacts et vidéos seulement',()=>{
 const posts=[post(10,'film',1234567,'Un titre',null,null,2000),post(11,'serie',1234568,'Un titre',1,2,2010),post(12,'serie',1234568,'Un titre',1,1,2010),{...post(13,'film',1234567,'Un titre'),fileName:'poster.jpg'}];
 assert.equal(findCopyPlans('un titre',posts).length,2);
 assert.equal(findCopyPlans('film Un titre 2000',posts)[0].messages.length,1);
 assert.deepEqual(findCopyPlans('série Un titre',posts)[0].messages.map(m=>m.messageId),[12,11]);
 assert.equal(findCopyPlans('serie-1234568',posts)[0].kind,'serie');
 assert.equal(findCopyPlans('Titre absent',posts).length,0);
});

test('une annonce gratuite protégée ne devient pas une vidéo copiée vers Premium',()=>{
 const announcement={...post(10,'film',1234567,'Un titre'),freeAccessToken:'a'.repeat(24)};
 assert.deepEqual(findCopyPlans('Un titre',[announcement]),[]);
});
