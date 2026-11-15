// Isolated integration-test process only. Never import this in application code.
import { execFile as callback } from 'node:child_process';
import { promisify } from 'node:util';
if (process.env.PREMIUM_TEST_FIXTURES !== '1') throw new Error('Test fixture disabled');
const execFile = promisify(callback);
const original = globalThis.fetch;
const sessions = new Map();
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input.toString());
  if (url.hostname === 'premium-redis.invalid') {
    const args = JSON.parse(options.body);
    const { stdout } = await execFile(process.env.REDIS_TEST_CLI, ['-s',process.env.PREMIUM_TEST_REDIS_SOCKET,'--json',...args.map(String)]);
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
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return original(input,options);
  throw new Error('Unexpected external network request in isolated test');
};
