// Isolated integration-test process only. Never import this in application code.
import { execFile as callback } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
if (process.env.PREMIUM_TEST_FIXTURES !== '1') throw new Error('Test fixture disabled');
const execFile = promisify(callback);
const original = globalThis.fetch;
const live = process.env.PREMIUM_TEST_LIVE_FIXTURE === "1";
const sessions = new Map();
const payments = new Map();
const checkouts = new Map();
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
  if(url.hostname==='api.telegram.org'){
    if(url.pathname.endsWith('/getChatMember')){const body=JSON.parse(options.body);return Response.json({ok:true,result:{status:body.user_id===23456?'creator':'administrator'}});}
    throw new Error('Unexpected Telegram mutation in payment fixture');
  }
  if (url.hostname === 'api.stripe.com') {
    if (url.pathname === '/v1/account') return Response.json({object:'account',charges_enabled:true,payouts_enabled:true});
    if (url.pathname === '/v1/balance') return Response.json({ object:'balance',livemode:live });
    if (url.pathname === '/v1/checkout/sessions' && options.method === 'POST') {
      const params = new URLSearchParams(options.body);
      const order = params.get('client_reference_id');
      const id = `cs_${live?"live":"test"}_fixture_${order.replaceAll('-','')}`;
      const session = { id,object:'checkout.session',mode:params.get('mode'),client_reference_id:order,
        amount_total:Number(params.get('line_items[0][price_data][unit_amount]')),currency:params.get('line_items[0][price_data][currency]'),
        livemode:live,payment_status:'paid',status:'complete',payment_intent:`pi_fixture_${order.replaceAll('-','')}`,
        url:`https://checkout.stripe.com/c/pay/${id}` };
      const state=JSON.parse(await readFile(process.env.PREMIUM_TEST_PAYMENT_STATE,'utf8'));if(state.stripePending){session.status='open';session.payment_status='unpaid';session.payment_intent=null;}
      sessions.set(id,session);
      return Response.json(session);
    }
    const expire=url.pathname.match(/\/checkout\/sessions\/([^/]+)\/expire$/);if(expire&&sessions.has(expire[1])){const session=sessions.get(expire[1]);if(session.status!=='open')return Response.json({error:{message:'not open'}},{status:400});session.status='expired';return Response.json(session);}
    const id = url.pathname.split('/').at(-1);
    if (sessions.has(id)) return Response.json(sessions.get(id));
    return Response.json({error:{type:'invalid_request_error',message:'Unknown test session'}},{status:404});
  }
  if(url.hostname===(live?'api.saspay.me':'sandbox-api.saspay.me')){
    if(url.pathname.endsWith('/countries/'))return Response.json({success:true,data:[{id:sasPayCountry,iso_code:'CG',name:'Congo',default_currency:'XAF',is_active:true}]});
    if(url.pathname.endsWith('/networks/'))return Response.json({success:true,data:{next:null,results:[{country:sasPayCountry,name:'MTN',code:'fixture_mtn_cg',is_active:true},{country:sasPayCountry,name:'Airtel',code:'fixture_airtel_cg',is_active:true}]}});
    if(url.pathname==='/api/v1/checkout-sessions/' && options.method==='POST'){
      const body=JSON.parse(options.body),id=randomUUID(),paymentId=randomUUID();
      if(body.country || body.network || body.customer_phone || body.amount!=='3000.00' || body.currency!=='XAF')throw new Error('Hosted contract');
      const session={...body,id,status:'PENDING',transaction:null,checkout_url:`https://${live?'checkout':'sandbox-checkout'}.saspay.me/checkout/${id}`};
      checkouts.set(id,{session,paymentId});
      // The checkout may settle in another currency. Source amount stays on the session.
      payments.set(paymentId,{id:paymentId,status:'PENDING',currency:'EUR',requested_amount:'4.57',description:'',transaction_type:'PAIEMENT',flow_direction:'INBOUND',updated_at:new Date().toISOString()});
      const state=JSON.parse(await readFile(process.env.PREMIUM_TEST_PAYMENT_STATE,'utf8'));
      const loseResponse=state.dropCheckoutResponse;state.dropCheckoutResponse=false;state.paymentIds={...state.paymentIds,[body.metadata.order_id]:paymentId};state.checkoutCreates=(state.checkoutCreates??0)+1;await writeFile(process.env.PREMIUM_TEST_PAYMENT_STATE,JSON.stringify(state));
      if(loseResponse)throw new Error('Simulated lost provider response AFTER session creation');
      return Response.json({success:true,data:session});
    }
    if(url.pathname==='/api/v1/checkout-sessions/'){const state=JSON.parse(await readFile(process.env.PREMIUM_TEST_PAYMENT_STATE,'utf8'));if(state.saspayPaid)for(const c of checkouts.values()){c.session.status='PAID';c.session.transaction=c.paymentId;}return Response.json({success:true,data:{next:null,results:[...checkouts.values()].map(c=>c.session)}});}
    const cancel=url.pathname.match(/\/checkout-sessions\/([^/]+)\/cancel\/$/);
    if(cancel&&checkouts.has(cancel[1])){const state=JSON.parse(await readFile(process.env.PREMIUM_TEST_PAYMENT_STATE,'utf8'));if(state.cancelFailure)return Response.json({success:false},{status:503});const c=checkouts.get(cancel[1]);if(c.session.status!=='PENDING')return Response.json({success:false},{status:409});c.session.status='CANCELLED';return Response.json({success:true,data:c.session});}
    const checkoutMatch=url.pathname.match(/\/checkout-sessions\/([^/]+)\/(status\/)?$/);
    if(checkoutMatch && checkouts.has(checkoutMatch[1])){
      const {session,paymentId}=checkouts.get(checkoutMatch[1]),state=JSON.parse(await readFile(process.env.PREMIUM_TEST_PAYMENT_STATE,'utf8'));
      if(state.saspayPaid&&session.status==='PENDING'){session.status='PAID';session.transaction=paymentId;}
      if(state.saspayProcessing&&session.status==='PENDING')session.transaction=paymentId;
      return Response.json({success:true,data:checkoutMatch[2]?{id:session.id,status:session.status,transaction_id:session.transaction,transaction_status:state.saspayPaid?'SUCCESS':null}:session});
    }
    if(url.pathname.endsWith('/payments/softpay/')){
      const body=JSON.parse(options.body);const key=options.headers['Idempotency-Key'];
      let payment=payments.get(key);
      if(!payment){payment={id:randomUUID(),status:'PENDING',currency:body.currency,requested_amount:body.amount,description:body.description,transaction_type:'PAIEMENT',flow_direction:'INBOUND',updated_at:'2026-11-16T10:00:00Z'};payments.set(key,payment);payments.set(payment.id,payment);}
      return Response.json({success:true,data:{id:payment.id,status:'PENDING',checkout_url:`https://${live?"pay":"sandbox-checkout"}.saspay.me/checkout/${payment.id}`}});
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
