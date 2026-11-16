import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {validGithubMaintenanceToken} from '../src/lib/premium-maintenance-auth.ts';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'fixture'};
const now=Date.parse('2026-11-16T12:00:00Z'),seconds=now/1000;
const claims={iat:seconds,exp:seconds+300,iss:'https://token.actions.githubusercontent.com',aud:'https://the-browser-one.vercel.app/api/premium/access/expire',repository:'manuelrt1203/the-browser',repository_owner:'manuelrt1203',repository_id:'1455838466',repository_owner_id:'230215107',ref:'refs/heads/main',sub:'repo:manuelrt1203/the-browser:ref:refs/heads/main',workflow_ref:'manuelrt1203/the-browser/.github/workflows/premium-expiration.yml@refs/heads/main',event_name:'schedule'};
const token=(data,header={alg:'RS256',kid:'fixture'})=>{const b=[header,data].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');return b+'.'+sign('RSA-SHA256',Buffer.from(b),privateKey).toString('base64url')};
test('Maintenance : identité signée du workflow main uniquement',async()=>{
 const keys=async()=>({keys:[jwk]});assert.equal(await validGithubMaintenanceToken(token(claims),keys,now),true);
 assert.equal(await validGithubMaintenanceToken(token({...claims,sub:'repo:manuelrt1203@230215107/the-browser@1455838466:ref:refs/heads/main'}),keys,now),true);
 for(const change of [{repository_id:'other'},{repository_owner_id:'other'},{sub:'repo:manuelrt1203@999/the-browser@1455838466:ref:refs/heads/main'},{aud:'other'},{iss:'https://attacker.example'},{repository:'other/repo'},{ref:'refs/heads/feature'},{sub:'repo:other'},{workflow_ref:'other'},{event_name:'pull_request'},{exp:seconds-1},{iat:seconds+120},{exp:seconds+1000},{nbf:seconds+120}])assert.equal(await validGithubMaintenanceToken(token({...claims,...change}),keys,now),false);
 assert.equal(await validGithubMaintenanceToken(token(claims,{alg:'none',kid:'fixture'}),keys,now),false);
 const forged=token(claims).split('.');forged[1]=Buffer.from(JSON.stringify({...claims,repository:'other'})).toString('base64url');assert.equal(await validGithubMaintenanceToken(forged.join('.'),keys,now),false);
});
