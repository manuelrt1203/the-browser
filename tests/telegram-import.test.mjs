import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script=fileURLToPath(new URL('../scripts/import-telegram.mjs',import.meta.url));

test('import réel du script : deux sources, canal isolé, rapport, seuil et réimport idempotent',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'catalogue-import-'));
 try{
  const input=join(directory,'export.json'), preload=join(directory,'mock.mjs'), report=join(directory,'report.json'), storage=join(directory,'storage');
  await writeFile(input,JSON.stringify({chats:{list:[
   {id:123,type:'public_channel',messages:[
    {id:1,type:'message',date_unixtime:'100',text:'House Of Dragon S3E1',file_name:'House of the Dragon - Saison 3 - Épisode 1 .mp4',media_type:'video_file'},
    {id:2,type:'message',date_unixtime:'100',text:'',file_name:'12.mp4',media_type:'video_file'},
   ]},
   {id:999,type:'public_channel',messages:[{id:3,type:'message',date_unixtime:'100',text:'Ne jamais importer ce canal'}]},
  ]}}));
  await writeFile(preload,`
  const show={id:94997,name:'House of the Dragon',original_name:'House of the Dragon',first_air_date:'2022-08-21'};
  globalThis.fetch=async(url)=>{
   if(process.env.MOCK_FAIL)return new Response('',{status:429});
   const u=new URL(url);if(u.hostname!=='api.themoviedb.org')throw new Error('unexpected host');
   if(u.pathname.includes('/search/'))return Response.json({results:[show],total_pages:1});
   if(u.pathname.includes('/season/'))return Response.json({season_number:3,episode_number:1});
   return Response.json(show);
  };
  `);
  const env={...process.env,TMDB_READ_TOKEN:'test',TELEGRAM_CHANNEL_ID:'-100123',CATALOGUE_DATA_DIR:storage};
  for(const key of ['VERCEL','KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','SITE_URL'])delete env[key];
  const run=(...flags)=>spawnSync(process.execPath,['--import',preload,'--experimental-strip-types',script,input,'123','--report',report,...flags],{env,cwd:directory,encoding:'utf8'});
  let child=run('--dry-run','--minimum-coverage','99');
  assert.equal(child.status,1,child.stderr);
  let result=JSON.parse(await readFile(report,'utf8'));
  assert.equal(result.posts,2);assert.equal(result.mediaPosts,2);assert.equal(result.fullyResolvedMediaPosts,1);assert.equal(result.mediaCoveragePercent,50);assert.equal(result.precisionPercent,null);assert.equal(result.thresholdMet,false);
  assert.equal(result.review[0].messageId,2);
  await assert.rejects(stat(storage));
  child=run();assert.equal(child.status,0,child.stderr);
  result=JSON.parse(await readFile(report,'utf8'));assert.equal(result.imported,2);
  const state=JSON.parse(await readFile(join(storage,'telegram-catalogue.json'),'utf8'));
  assert.equal(Object.keys(state.posts).length,2);
  assert.equal(state.posts['-100123:1'].fileName,'House of the Dragon - Saison 3 - Épisode 1 .mp4');
  assert.equal(state.posts['-100123:1'].titles[0].episode,1);
  child=run();assert.equal(child.status,0,child.stderr);
  result=JSON.parse(await readFile(report,'utf8'));assert.equal(result.imported,0);assert.equal(result.unchanged,2);
  const before=await readFile(join(storage,'telegram-catalogue.json'),'utf8');
  env.MOCK_FAIL='1';child=run();assert.equal(child.status,1,child.stderr);
  result=JSON.parse(await readFile(report,'utf8'));assert.ok(result.failed>0);
  assert.equal(await readFile(join(storage,'telegram-catalogue.json'),'utf8'),before);
 }finally{await rm(directory,{recursive:true,force:true});}
});
