import test from 'node:test';
import assert from 'node:assert/strict';
import {featuredReleases,posterSlot} from '../src/lib/featured-releases.ts';
const title=(id,changes={})=>({id,title:id,kind:'film',year:2026,genres:[],synopsis:'',watchUrl:'https://example.com',poster:'https://image.tmdb.org/t/p/w500/fixture.jpg',telegramUrl:'https://t.me/TheBrowser365/123',...changes});
test('Sélection 2026 : uniquement titres disponibles dans le canal, avec affiche, sans doublon',()=>{
 const items=[title('Z'),title('A'),title('Z'),title('old',{year:2025}),title('future',{year:2027}),title('missing',{telegramUrl:undefined}),title('no-poster',{poster:undefined}),title('elsewhere',{telegramUrl:'https://t.me/OtherChannel/1'}),title('fake',{telegramUrl:'https://t.me.attacker.example/TheBrowser365/1'}),title('private',{telegramUrl:'https://t.me/c/4339801492/10'})];
 assert.deepEqual(featuredReleases(items).map(x=>x.id),['A','private','Z']);
 assert.deepEqual(featuredReleases([title('none',{year:2024})]),[]);
});
test('Coverflow : bouclage des positions, jeux courts et groupe limité à cinq affiches',()=>{
 assert.equal(posterSlot(4,0,5),-1);assert.equal(posterSlot(0,4,5),1);assert.equal(posterSlot(0,0,1),0);assert.equal(posterSlot(1,0,2),1);assert.equal(posterSlot(0,0,0),null);
 for(let current=0;current<20;current++){const slots=Array.from({length:20},(_,i)=>posterSlot(i,current,20)).filter(x=>x!==null);assert.equal(slots.length,5);assert.deepEqual(slots.toSorted((a,b)=>a-b),[-2,-1,0,1,2]);}
});
