import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentTestRuntime,paymentTestOrigin } from '../src/lib/payment-test-runtime.ts';
test('paiement : prévisualisation explicite seulement, jamais le site Vercel de production',()=>{
  const names=['NODE_ENV','VERCEL','VERCEL_ENV','PREMIUM_ENVIRONMENT','SASPAY_TEST_ENABLED','SITE_URL'];const old=Object.fromEntries(names.map(n=>[n,process.env[n]]));
  try{
    process.env.NODE_ENV='production';process.env.VERCEL='1';process.env.VERCEL_ENV='production';process.env.PREMIUM_ENVIRONMENT='test';process.env.SASPAY_TEST_ENABLED='1';process.env.SITE_URL='https://preview.example.com';
    assert.equal(paymentTestRuntime('SASPAY_TEST_ENABLED'),false);assert.throws(()=>paymentTestOrigin('https://preview.example.com'));
    process.env.VERCEL_ENV='preview';assert.equal(paymentTestRuntime('SASPAY_TEST_ENABLED'),true);assert.equal(paymentTestOrigin('https://preview.example.com'),'https://preview.example.com');
    assert.throws(()=>paymentTestOrigin('https://attacker.example'));assert.throws(()=>paymentTestOrigin('http://preview.example.com'));
    process.env.PREMIUM_ENVIRONMENT='live';assert.equal(paymentTestRuntime('SASPAY_TEST_ENABLED'),false);
  }finally{for(const[n,v]of Object.entries(old)){if(v===undefined)delete process.env[n];else process.env[n]=v;}}
});
