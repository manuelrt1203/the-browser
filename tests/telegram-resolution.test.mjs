import test from 'node:test';
import assert from 'node:assert/strict';
import { createResolver, parseCandidate, resolvePublication, matchesCandidate } from '../src/lib/telegram-resolution.ts';

const fixtures = [
  ['House Of Dragon S3E1', 'House of the Dragon', 'serie', 2022,3,1],
  ['House of the Dragon - Saison 3 - Épisode 1 .mp4','House of the Dragon','serie',2022,3,1],
  ['House of dagon S3E2.mp4','House of the Dragon','serie',2022,3,2],
  ['Reacher.S04e04.Karambits.And.Pieces.Amzn.Web.H264-Byor.mp4','Reacher','serie',2022,4,4],
  ['[ @Films_and_series_Fr ] From Saison 4 Ep 05 VF.mp4','From','serie',2022,4,5],
  ['Les carnets de l’apothicaire S01EP01.mp4','Les carnets de l’apothicaire','serie',2023,1,1],
  ['Miraculous SO7E01.mp4','Miraculous : Les Aventures de Ladybug et Chat Noir','serie',2015,7,1],
  ['Superman And Lois 2021.mp4','Superman et Loïs','serie',2021],
  ['EP 2Squid Game.mp4','Squid Game','serie',2021,undefined,2],
  ['A Different Worldt S01E02.mp4','A Different World','serie',undefined,1,2],
  ['Aladdin 2019.mp4','Aladdin','film',2019],
  ['Brothers.2009.FRENCH.mp4','Brothers','film',2009],
  ['Film Flashpoint 2007 @FilmSerieFeuilleton.mp4','Flashpoint','film',2007],
  ['Let It Shine 2012.mp4','Let It Shine','film',2012],
  ['_@ACT_ZONE@_MAÎTRES_DE_L’UNIVERS_VF.mp4','Les Maîtres de l’univers','film'],
  ['_🎥ACTION_ZONE🎥MUTINY_VF_2026.mp4','MUTINY','film',2026],
  ['Moana.2026.Multi.Ca.WEBRIP.mp4','Moana','film',2026],
  ['Moana (Live Action)','Moana','film',2026],
  ['HOPE_Film_Complet_en_Français_SALMAN_DILMAHOMED_360p,_h264.mp4','HOPE','film'],
  ['Resident Evil 2026 Multi Ca.mp4','Resident Evil','film',2026],
  ['@yahxe~Kill Zone 2005.mp4','Kill Zone','film',2005],
  ['shreeek 3.mpg','Shrek le troisième','film',2007],
  ['shreek 2.mpg','Shrek 2','film',2004],
  ['Oxtorrent.Com.The.Fault.In.Our.Stars.2014.mp4','Nos étoiles contraires','film',2014],
];
for (const [input,query,kind,year,season,episode] of fixtures) test(`corpus : ${input}`, () => {
  const actual=parseCandidate(input);
  assert.ok(actual);
  assert.equal(actual.query,query);
  assert.equal(actual.kind,kind);
  assert.equal(actual.year,year);
  assert.equal(actual.season,season);
  assert.equal(actual.episode,episode);
});

test('les fichiers auxiliaires et appels promotionnels ne sont pas des titres', () => {
  for (const input of ['index-v1-a1','sticker webp','AJOUTE NOTRE DOSSIER COMPLET','1.mp4','https://t.me/addlist/test']) assert.equal(parseCandidate(input),null,input);
});

test('le titre, le type et l’année protègent des remakes et faux IDs', () => {
  assert.equal(matchesCandidate({id:651,name:'60 Minutes',first_air_date:'1968-01-01'},'serie',{query:'A Different World',kind:'serie'}),false);
  assert.equal(matchesCandidate({id:103269,title:'Superman contre l’Élite',release_date:'2012-01-01'},'film',{query:'Let It Shine',kind:'film',year:2012}),false);
  assert.equal(matchesCandidate({id:277834,title:'Moana',release_date:'2016-01-01'},'film',{query:'Moana',kind:'film',year:2026}),false);
  assert.equal(matchesCandidate({id:1,name:'Carrie',first_air_date:'2026-01-01'},'serie',{query:'Carrie',kind:'film'}),false);
});

async function mockTmdb(run, handler) {
  const old=globalThis.fetch, token=process.env.TMDB_READ_TOKEN;
  process.env.TMDB_READ_TOKEN='test-token';
  globalThis.fetch=async (input) => {
    const url=new URL(input);
    assert.equal(url.hostname,'api.themoviedb.org');
    return handler(url);
  };
  try { await run(); } finally { globalThis.fetch=old; if(token===undefined)delete process.env.TMDB_READ_TOKEN;else process.env.TMDB_READ_TOKEN=token; }
}
const show={id:94997,name:'House of the Dragon',original_name:'House of the Dragon',first_air_date:'2022-08-21'};
test('l’exemple utilisateur lit nom de fichier et texte, conserve saison/épisode et mutualise les recherches', () => {
  let searches=0;
  return mockTmdb(async () => {
    const result=await resolvePublication({text:'House Of Dragon S3E1',fileName:'House of the Dragon - Saison 3 - Épisode 1 .mp4'});
    assert.deepEqual(result.review,[]);
    assert.equal(result.titles.length,1);
    assert.equal(result.titles[0].id,94997);
    assert.equal(result.titles[0].season,3);
    assert.equal(result.titles[0].episode,1);
    assert.equal(searches,1);
  },url => {
    if(url.pathname.endsWith('/search/tv')){searches++;return Response.json({results:[show],total_pages:1});}
    if(url.pathname.includes('/season/'))return Response.json({season_number:3,episode_number:1});
    return Response.json(show);
  });
});

test('une homonymie reste en attente ; aucune sélection du premier résultat', () => mockTmdb(async () => {
  const decision=await createResolver()({query:'Brothers',kind:'film'});
  assert.equal(decision.title,undefined);assert.equal(decision.reason,'ambigu');assert.equal(decision.candidates.length,2);
},()=>Response.json({results:[{id:1,title:'Brothers',release_date:'2004-01-01'},{id:2,title:'Brothers',release_date:'2009-01-01'}],total_pages:1})));

test('le bon remake est choisi par année et vérifié sur sa fiche', () => mockTmdb(async () => {
  const decision=await createResolver()({query:'Brothers',kind:'film',year:2009});
  assert.equal(decision.title.id,2);assert.equal(decision.title.year,2009);
},url=>Response.json(url.pathname.includes('/search/')?{results:[{id:1,title:'Brothers',release_date:'2004-01-01'},{id:2,title:'Brothers',release_date:'2009-01-01'}],total_pages:1}:{id:2,title:'Brothers',release_date:'2009-01-01'})));

test('une fiche incohérente ne valide pas les résultats de recherche', () => mockTmdb(async () => {
  const decision=await createResolver()({query:'Let It Shine',kind:'film',year:2012});
  assert.equal(decision.title,undefined);assert.equal(decision.reason,'fiche-incoherente');
},url=>Response.json(url.pathname.includes('/search/')?{results:[{id:103269,title:'Let It Shine',release_date:'2012-01-01'}],total_pages:1}:{id:103269,title:'Superman contre l’Élite',release_date:'2012-01-01'})));

test('la pagination ne masque pas un deuxième homonyme', () => mockTmdb(async () => {
  const decision=await createResolver()({query:'Brothers',kind:'film'});
  assert.equal(decision.reason,'ambigu');
},url=>Response.json({results:[{id:Number(url.searchParams.get('page')),title:'Brothers',release_date:'2009-01-01'}],total_pages:2})));

test('une panne TMDB n’est pas convertie en succès ni en titre introuvable', () => mockTmdb(async () => {
  await assert.rejects(resolvePublication({fileName:'Brothers 2009.mp4'}),/TMDB HTTP 429/);
},()=>new Response('',{status:429})));

test('les contradictions de titre ou d’épisode vont en révision', async () => {
  const resolve=async (c)=>({title:{kind:'serie',id:c.query==='House of the Dragon'?94997:108978,expectedTitle:c.query,season:c.season,episode:c.episode}});
  for(const input of [
    {text:'House Of Dragon S3E1',fileName:'Reacher S01E01.mp4'},
    {text:'House Of Dragon S3E1',fileName:'House of the Dragon Saison 3 Épisode 2.mp4'},
  ]){
    const result=await resolvePublication(input,resolve);
    assert.equal(result.titles.length,0);assert.ok(result.review.some(x=>x.reason==='sources-contradictoires'));
  }
});

test('un fichier numéroté sans titre reste à identifier', async()=>{
  const result=await resolvePublication({fileName:'12.mp4'});
  assert.equal(result.titles.length,0);assert.equal(result.review[0].reason,'fichier-sans-titre-identifiable');
});

test('le nom de fichier complète l’année manquante de la légende', async()=>{
  const seen=[];
  const result=await resolvePublication({text:'Brothers',fileName:'Brothers.2009.mp4'},async c=>{
    seen.push(c);return {title:{kind:'film',id:2,expectedTitle:'Brothers',year:c.year}};
  });
  assert.ok(seen.every(c=>c.year===2009));assert.equal(result.titles.length,1);
});

test('l’épisode absent de TMDB n’est pas annoncé comme identifié', () => mockTmdb(async()=>{
  const result=await resolvePublication({text:'House Of Dragon S3E99'});
  assert.equal(result.titles[0].id,94997);
  assert.equal(result.titles[0].episode,undefined);
  assert.equal(result.review[0].reason,'episode-non-verifie');
},url=>url.pathname.includes('/season/')?new Response('',{status:404}):Response.json(url.pathname.includes('/search/')?{results:[show],total_pages:1}:show)));

test('les six anciennes associations erronées ou de mauvaise version ne sont plus dans la sélection', async()=>{
  const {requestedTitles,revokedLegacyReferences}=await import('../src/data/selection.ts');
  for(const item of requestedTitles)if(item.id)assert.equal(revokedLegacyReferences.has(`${item.kind}:${item.id}`),false);
  assert.equal(requestedTitles.find(t=>t.title==='Moana').year,2026);
  assert.equal(requestedTitles.find(t=>t.title==='Dragon Ball Super').kind,'serie');
});
