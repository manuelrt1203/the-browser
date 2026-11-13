import test from 'node:test';
import assert from 'node:assert/strict';
import {sortCatalogue,telegramMessageUrl,publicationsForTitle} from '../src/lib/catalogue-links.ts';
const post=(messageId,titles,extra={})=>({messageId,version:100,updateId:1,text:'',pending:[],titles,...extra});

test('tri français naturel et stable sans modifier la liste fournie',()=>{
 const names=['Shrek 10','Éternels','avatar','Shrek 2','Aladdin'];
 const items=names.map((title,n)=>({title,id:String(n),year:2026}));
 assert.deepEqual(sortCatalogue(items).map(i=>i.title),['Aladdin','avatar','Éternels','Shrek 2','Shrek 10']);
 assert.deepEqual(items.map(i=>i.title),names);
 assert.deepEqual(sortCatalogue([{title:'Avatar',year:2024,id:'2'},{title:'Avatar',year:2005,id:'1'}]).map(i=>i.year),[2005,2024]);
});

test('liens vers les IDs exacts du canal public et autres canaux',()=>{
 assert.equal(telegramMessageUrl('-1004339801492',650),'https://t.me/TheBrowser365/650');
 assert.equal(telegramMessageUrl('-10012345',12),'https://t.me/c/12345/12');
 for(const [channel,id] of [['bad',1],['-100123',0],['-100123',1.2],['-100123',NaN],['-100',2]])assert.equal(telegramMessageUrl(channel,id),null);
});

test('le film vise son fichier, pas son annonce ni un autre film',()=>{
 const posts={
  '-1004339801492:10':post(10,[{kind:'film',id:671}]),
  '-1004339801492:20':post(20,[{kind:'film',id:672}],{fileName:'Autre.mp4'}),
  '-1004339801492:30':post(30,[{kind:'film',id:671}],{fileName:'Harry Potter.mkv'}),
  '-1004339801492:40':post(99,[{kind:'film',id:671}],{fileName:'Corrompu.mp4'}),
 };
 assert.equal(publicationsForTitle('film-671',posts)[0].url,'https://t.me/TheBrowser365/30');
 assert.equal(publicationsForTitle('film-671',posts).length,2);
 assert.deepEqual(publicationsForTitle('film-999',posts),[]);
});

test('séries : choix des épisodes triés et dédupliqués, provenance du canal préservée',()=>{
 const ref=(season,episode)=>({kind:'serie',id:94997,season,episode});
 const posts={
  '-1004339801492:1':post(1,[ref(1,1)]),
  '-1004339801492:10':post(10,[ref(2,1)],{fileName:'S2E1.mp4'}),
  '-1004339801492:20':post(20,[ref(1,2)],{fileName:'S1E2.mp4'}),
  '-1004339801492:30':post(30,[ref(1,1)],{fileName:'S1E1.mp4'}),
  '-1004339801492:40':post(40,[{kind:'serie',id:94997,sourceEpisode:{season:3,episode:1,verifiedBy:'owner'}}],{fileName:'S3E1.mkv'}),
 };
 const result=publicationsForTitle('serie-94997',posts);
 assert.deepEqual(result.map(p=>[p.season,p.episode]),[[1,1],[1,2],[2,1],[3,1]]);
 assert.equal(result[0].messageId,30);
 assert.equal(result[3].numbering,'channel');
});
