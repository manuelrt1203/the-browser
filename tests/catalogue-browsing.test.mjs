import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogueState,catalogueHref,browseCatalogue,decodeWatchlist} from '../src/lib/catalogue-browsing.ts';
import {latestPublicationIdForTitle} from '../src/lib/catalogue-links.ts';
const item=(id,title,changes={})=>({id,title,kind:'film',year:2026,genres:['Comédie'],synopsis:'',watchUrl:'https://example.com',telegramUrl:'https://t.me/TheBrowser365/1',...changes});
const state=query=>catalogueState(new URLSearchParams(query));
test('Catalogue : filtres combinés, accents/casse, année et paramètres malformés',()=>{
 const items=[item('film-1','Été'),item('serie-2','Été',{kind:'serie'}),item('film-3','Été',{year:2025}),item('film-4','Autre')];
 assert.deepEqual(browseCatalogue(items,state('q=ETE&type=film&annee=2026&genre=Comédie'),new Set()).map(x=>x.id),['film-1']);
 assert.equal(state('type=evil&vue=evil&annee=oops&fiche=https://evil.example').kind,'tous');assert.equal(state('annee=oops').year,'');
 assert.equal(state('q='+('a'.repeat(300))).q.length,200);
});
test('Catalogue : les ajouts récents suivent les publications, pas la sortie cinéma',()=>{
 const old=item('film-1','Ancien',{year:1980,latestPublicationId:100}),recent=item('film-2','Nouveau',{latestPublicationId:20}),unknown=item('film-3','Sans publication',{telegramUrl:undefined});
 assert.deepEqual(browseCatalogue([recent,unknown,old],state('vue=recent'),new Set()).map(x=>x.id),['film-1','film-2']);
 assert.deepEqual(browseCatalogue([recent,old],state('vue=a-voir'),new Set(['film-2'])).map(x=>x.id),['film-2']);
});
test('Catalogue : URL partageable locale, filtres conservés, retrait d’un paramètre',()=>{
 const url=catalogueHref(new URLSearchParams('q=été&type=film&utm_source=canal'),{fiche:'film-1',annee:'2026',type:null});
 const parsed=new URL(url,'https://example.com');assert.equal(parsed.pathname,'/');assert.equal(parsed.searchParams.get('q'),'été');assert.equal(parsed.searchParams.get('utm_source'),'canal');assert.equal(parsed.searchParams.get('fiche'),'film-1');assert.equal(parsed.searchParams.has('type'),false);assert.equal(parsed.hash,'#catalogue');
});
test('À voir : version locale validée, erreurs JSON, doublons et identifiants invalides',()=>{
 assert.deepEqual(decodeWatchlist('["film-1","film-1","serie-2","evil","film-0",4]'),['film-1','serie-2']);assert.deepEqual(decodeWatchlist('broken'),[]);assert.deepEqual(decodeWatchlist('{"x":"film-1"}'),[]);assert.deepEqual(decodeWatchlist('a'.repeat(65000)),[]);
});
test('Dernière publication : reprise d’un titre et modifications anciennes distinguées',()=>{
 const post=(messageId,version)=>({messageId,version,updateId:1,text:'',titles:[{kind:'film',id:1}],pending:[]});
 const posts={'-1004339801492:1':post(1,9999999999),'-1004339801492:15':post(15,1),'bad:999':post(999,5),'-1004339801492:25':post(24,7)};
 assert.equal(latestPublicationIdForTitle('film-1',posts),15);assert.equal(latestPublicationIdForTitle('film-2',posts),undefined);
});
