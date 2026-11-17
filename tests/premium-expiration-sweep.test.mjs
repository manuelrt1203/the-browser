import test from 'node:test';
import assert from 'node:assert/strict';
import {runExpirationSweep} from '../src/lib/premium-expiration-sweep.ts';
function fixture(results, checkpoint={cursor:'0',failed:0}) {
 const saved=[],seen=[];
 return {saved,seen,deps:{load:async()=>checkpoint,save:async value=>saved.push(value),batch:async cursor=>{seen.push(cursor);return results.shift()}}};
}
test('balaye plusieurs pages et remet le checkpoint à zéro',async()=>{
 const f=fixture([{cursor:'12',processed:25,failed:0},{cursor:'0',processed:2,failed:0}]);
 assert.deepEqual(await runExpirationSweep(f.deps),{complete:true,cursor:'0',processed:27,failed:0});assert.deepEqual(f.seen,['0','12']);
});
test('budget écoulé : enregistre le prochain curseur puis reprend',async()=>{
 const f=fixture([{cursor:'15',processed:25,failed:0}]);let time=0;
 const result=await runExpirationSweep({...f.deps,now:()=>time++?100:0,budgetMs:50});assert.equal(result.complete,false);
 const next=fixture([{cursor:'0',processed:1,failed:0}],f.saved.at(-1));assert.equal((await runExpirationSweep(next.deps)).complete,true);assert.deepEqual(next.seen,['15']);
});
test('conserve les erreurs des appels précédents jusqu’à la fin du cycle',async()=>{
 const f=fixture([{cursor:'0',processed:2,failed:1}],{cursor:'7',failed:3});
 assert.equal((await runExpirationSweep(f.deps)).failed,4);assert.deepEqual(f.saved.at(-1),{cursor:'0',failed:0});
});
test('une panne ne fait pas avancer le curseur',async()=>{
 const f=fixture([],{cursor:'8',failed:0});f.deps.batch=async()=>{throw Error('Redis indisponible')};await assert.rejects(runExpirationSweep(f.deps));assert.equal(f.saved.length,0);
});
test('rejette checkpoints et réponses incohérents',async()=>{
 const f=fixture([],{cursor:'bad',failed:0});await assert.rejects(runExpirationSweep(f.deps));assert.equal(f.seen.length,0);
 const invalid=fixture([{cursor:'0',processed:1,failed:2}]);await assert.rejects(runExpirationSweep(invalid.deps));assert.equal(invalid.saved.length,0);
});
