// Isolated integration-test process only. Never import this in application code.
import { execFile as callback } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
if (process.env.PREMIUM_TEST_FIXTURES !== '1') throw new Error('Test fixture disabled');
const execFile = promisify(callback);
const original = globalThis.fetch;
const sessions = new Map();
const payments = new Map();
const sasPayCountry='3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f6a';
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input.toString());
  if (url.hostname === 'premium-redis.invalid') {
    const args = JSON.parse(options.body);
    // Upstash REST uses RESP2-style flat arrays for HGETALL; redis-cli --json
    // otherwise defaults to RESP3 maps, which would change the wire contract.
    const { stdout } = await execFile(process.env.REDIS_TEST_CLI, ['-s',process.env.PREMIUM_TEST_REDIS_SOCKET,'-2','--json',...args.map(String)]);
    return Response.json({ result: JSON.parse(stdout) });
  }
  if (url.hostname === 'api.stripe.com') {
    if (url.pathname === '/v1/balance') return Response.json({ object:'balance',livemode:false });
    if (url.pathname === '/v1/checkout/sessions' && options.method === 'POST') {
      const params = new URLSearchParams(options.body);
      const order = params.get('client_reference_id');
      const id = `cs_test_fixture_${order.replaceAll('-','')}`;
      const session = { id,object:'checkout.session',mode:params.get('mode'),client_reference_id:order,
        amount_total:Number(params.get('line_items[0][price_data][unit_amount]')),currency:params.get('line_items[0][price_data][currency]'),
        livemode:false,payment_status:'paid',status:'complete',payment_intent:`pi_fixture_${order.replaceAll('-','')}`,
        url:`https://checkout.stripe.com/c/pay/${id}` };
      sessions.set(id,session);
      return Response.json(session);
    }
    const id = url.pathname.split('/').at(-1);
    if (sessions.has(id)) return Response.json(sessions.get(id));
    return Response.json({error:{type:'invalid_request_error',message:'Unknown test session'}},{status:404});
  }
  if(url.hostname==='api.saspay.me'){
    if(url.pathname.endsWith('/countries/'))return Response.json({success:true,data:[{id:sasPayCountry,iso_code:'CG',name:'Congo',default_currency:'XAF',is_active:true}]});
    if(url.pathname.endsWith('/networks/'))return Response.json({success:true,data:{next:null,results:[{country:sasPayCountry,name:'MTN',code:'fixture_mtn_cg',is_active:true},{country:sasPayCountry,name:'Airtel',code:'fixture_airtel_cg',is_active:true}]}});
    if(url.pathname.endsWith('/payments/softpay/')){
      const body=JSON.parse(options.body);const key=options.headers['Idempotency-Key'];
      let payment=payments.get(key);
      if(!payment){payment={id:randomUUID(),status:'PENDING',currency:body.currency,requested_amount:body.amount,description:body.description,transaction_type:'PAIEMENT',flow_direction:'INBOUND',updated_at:'2026-11-16T10:00:00Z'};payments.set(key,payment);payments.set(payment.id,payment);}
      return Response.json({success:true,data:{id:payment.id,status:'PENDING',checkout_url:`https://pay.saspay.me/checkout/${payment.id}`}});
    }
    const match=url.pathname.match(/\/payments\/([^/]+)\/verify\/$/);
    if(match&&payments.has(match[1])){
      const state=JSON.parse(await readFile(process.env.PREMIUM_TEST_PAYMENT_STATE,'utf8'));
      return Response.json({success:true,data:{...payments.get(match[1]),status:state.saspayPaid?'SUCCESS':'PENDING'}});
    }
    return Response.json({success:false},{status:404});
  }
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return original(input,options);
  throw new Error('Unexpected external network request in isolated test');
};
