import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseChannelText, readChannelState, saveChannelPost } from '../src/lib/telegram-store.ts';

test('références film/série, doublons, texte ambigu et faux domaines', () => {
  assert.deepEqual(parseChannelText('Film https://www.themoviedb.org/movie/671\nhttps://www.themoviedb.org/movie/671\nhttps://www.themoviedb.org/tv/93405-squid-game\nAladdin\nhttps://evil.example/movie/123'), {
    titles: [{kind:'film', id:671}, {kind:'serie', id:93405}],
    pending: ['Aladdin', 'https://evil.example/movie/123']
  });
});

test('persistance, concurrence, retries et modifications dans la même seconde', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'telegram-test-'));
  const file = join(directory, 'catalogue.json');
  const post = {messageId: 1, version: 100, updateId: 1, text:'original', titles:[{kind:'film',id:671}], pending:[]};
  try {
    await Promise.all([saveChannelPost('-1001', post, file), saveChannelPost('-1001', {...post, messageId:2}, file)]);
    assert.equal(Object.keys((await readChannelState(file)).posts).length, 2);
    assert.equal(await saveChannelPost('-1001', post, file), false);
    assert.equal(await saveChannelPost('-1001', {...post, updateId:2, text:'édition', titles:[]}, file), true);
    assert.equal(await saveChannelPost('-1001', post, file), false);
    const saved = (await readChannelState(file)).posts['-1001:1'];
    assert.equal(saved.text, 'édition');
    assert.deepEqual(saved.titles, []);
    await writeFile(file, 'corrompu');
    await assert.rejects(saveChannelPost('-1001', {...post, updateId:3}, file));
  } finally { await rm(directory, {recursive:true, force:true}); }
});

test('reconnaît les légendes et fichiers de l’export sans confondre les suites', async () => {
  const { matchKnownTitle } = await import('../src/lib/telegram-store.ts');
  const known = [{title:'House of the Dragon',kind:'serie',id:94997},{title:'Reacher',kind:'serie',id:108978},{title:'Spider-Man',kind:'film',id:557},{title:'Spider-Man 2',kind:'film',id:558}];
  assert.deepEqual(matchKnownTitle('House Of Dagon S3E2', known), {kind:'serie',id:94997});
  assert.deepEqual(matchKnownTitle('Reacher.S04e04.Karambits.Amzn.Web.H264.mp4', known), {kind:'serie',id:108978});
  assert.deepEqual(matchKnownTitle('SpiderMan2.mp4', known), {kind:'film',id:558});
  assert.equal(matchKnownTitle('Film inconnu', known), null);
});

test('réanalyse de l’historique sans écraser une modification plus récente', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'telegram-reanalyse-'));
  const file = join(directory,'catalogue.json');
  const legacy={messageId:1,version:100,updateId:20,text:'Let It Shine',titles:[{kind:'film',id:103269}],pending:[]};
  try {
    await saveChannelPost('-1001',legacy,file);
    assert.equal(await saveChannelPost('-1001',{...legacy,updateId:-1,resolutionVersion:2,titles:[],pending:['Let It Shine']},file),true);
    let saved=(await readChannelState(file)).posts['-1001:1'];
    assert.equal(saved.updateId,20);assert.equal(saved.resolutionVersion,2);assert.deepEqual(saved.titles,[]);
    assert.equal(await saveChannelPost('-1001',{...legacy,updateId:-1,resolutionVersion:2},file),false);
    assert.equal(await saveChannelPost('-1001',{...legacy,version:99,resolutionVersion:3},file),false);
    assert.equal(await saveChannelPost('-1001',{...legacy,text:'Autre texte',updateId:-1,resolutionVersion:3},file),false);
    saved=(await readChannelState(file)).posts['-1001:1'];assert.equal(saved.text,'Let It Shine');
  } finally {await rm(directory,{recursive:true,force:true});}
});

test('un réimport explicite peut corriger une analyse de même version, sans revenir sur un événement plus récent', async () => {
  const directory=await mkdtemp(join(tmpdir(),'telegram-reimport-'));const file=join(directory,'data.json');
  const post={messageId:1,version:100,updateId:20,resolutionVersion:2,text:'Titre',fileName:'Titre.mp4',titles:[],pending:['Titre']};
  try {
    await saveChannelPost('-1001',post,file);
    const corrected={...post,updateId:-1,titles:[{kind:'film',id:1}],pending:[]};
    assert.equal(await saveChannelPost('-1001',corrected,file,{reanalyse:true}),true);
    assert.equal((await readChannelState(file)).posts['-1001:1'].updateId,20);
    assert.equal(await saveChannelPost('-1001',corrected,file,{reanalyse:true}),false);
    assert.equal(await saveChannelPost('-1001',{...corrected,version:99},file,{reanalyse:true}),false);
    assert.equal(await saveChannelPost('-1001',{...corrected,fileName:'Autre.mp4'},file,{reanalyse:true}),false);
    assert.equal(await saveChannelPost('-1001',{...corrected,fileName:undefined},file,{reanalyse:true}),false);
  } finally {await rm(directory,{recursive:true,force:true});}
});

test('la provenance humaine persiste sans devenir une numérotation TMDB',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'owner-episode-'));const file=join(directory,'catalogue.json');
 const post={messageId:650,version:100,updateId:1,text:'Vérifié',titles:[{kind:'serie',id:220542,sourceEpisode:{season:2,episode:1,verifiedBy:'owner'}}],pending:[]};
 try{
  assert.equal(await saveChannelPost('-1001',post,file),true);
  const ref=(await readChannelState(file)).posts['-1001:650'].titles[0];
  assert.equal(ref.season,undefined);assert.equal(ref.episode,undefined);assert.deepEqual(ref.sourceEpisode,post.titles[0].sourceEpisode);
  await assert.rejects(saveChannelPost('-1001',{...post,updateId:2,titles:[{...post.titles[0],sourceEpisode:{season:2,episode:1,verifiedBy:'automatic'}}]},file),/invalide/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
