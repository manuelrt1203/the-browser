import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { createPremiumOrder } from '../src/lib/subscription.ts';
import { applyStripeTestEvent, testCheckoutParameters, stripeTestEnabled } from '../src/lib/stripe-test.ts';

function fixtures() {
  const order = { ...createPremiumOrder(randomUUID(), 'stripe'), sessionId: 'cs_test_example', checkoutUrl: 'https://checkout.stripe.com/test', eventIds: [] };
  const session = { id: order.sessionId, mode: 'payment', client_reference_id: order.id, currency: 'eur', amount_total: 457,
    livemode: false, payment_status: 'paid', status: 'complete', payment_intent: 'pi_example' };
  const event = { id: 'evt_paid', type: 'checkout.session.completed', livemode: false,
    created: Date.parse('2026-01-31T14:00:00Z') / 1000, data: { object: session } };
  return { order, session, event };
}

test('Checkout : 457 centimes, paiement ponctuel, référence serveur et retour local seulement', () => {
  const oldEnv=process.env.NODE_ENV;process.env.NODE_ENV='development';
  let params;try { params = testCheckoutParameters(randomUUID(), 'http://127.0.0.1:3001'); }
  finally { if(oldEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldEnv; }
  assert.equal(params.mode, 'payment');
  assert.equal(params.line_items[0].price_data.unit_amount, 457);
  assert.equal(params.line_items[0].price_data.currency, 'eur');
  assert.equal(params.payment_method_types, undefined);
  assert.equal(params.subscription_data, undefined);
  assert.equal(params.adaptive_pricing.enabled, false);
  assert.throws(() => testCheckoutParameters(randomUUID(), 'https://attacker.example'));
});

test('pilote Stripe : fermé en production, sur Vercel et dans l’espace réel', () => {
  const names=['NODE_ENV','STRIPE_TEST_CHECKOUT_ENABLED','PREMIUM_ENVIRONMENT','VERCEL','VERCEL_ENV'];
  const old=Object.fromEntries(names.map(n=>[n,process.env[n]]));
  try {
    process.env.NODE_ENV='development';process.env.STRIPE_TEST_CHECKOUT_ENABLED='1';process.env.PREMIUM_ENVIRONMENT='test';process.env.VERCEL_ENV='production';delete process.env.VERCEL;
    assert.equal(stripeTestEnabled(),true);
    process.env.PREMIUM_ENVIRONMENT='live';assert.equal(stripeTestEnabled(),false);
    process.env.PREMIUM_ENVIRONMENT='test';process.env.NODE_ENV='production';assert.equal(stripeTestEnabled(),false);
    process.env.NODE_ENV='development';process.env.VERCEL='1';assert.equal(stripeTestEnabled(),false);
  } finally { for(const [n,v] of Object.entries(old)){if(v===undefined)delete process.env[n];else process.env[n]=v;} }
});

test('confirmation signée rapprochée : même paiement et événements répétés ne doublent pas le mois', () => {
  const { order, session, event } = fixtures();
  const paid = applyStripeTestEvent(order, event, session);
  assert.equal(paid.status, 'confirmed');
  assert.equal(paid.expiresAt, '2026-02-28T14:00:00.000Z');
  assert.strictEqual(applyStripeTestEvent(paid, event, session), paid);
  const replay = applyStripeTestEvent(paid, { ...event, id: 'evt_async', type: 'checkout.session.async_payment_succeeded', created: event.created + 86400 }, session);
  assert.equal(replay.expiresAt, paid.expiresAt);
});

test('completed impayé attend le succès différé ; échec et expiration ne donnent pas de droits', () => {
  const { order, session, event } = fixtures();
  const unpaid = { ...session, payment_status: 'unpaid' };
  const pending = applyStripeTestEvent(order, { ...event, data: { object: unpaid } }, unpaid);
  assert.equal(pending.status, 'pending');
  const failed = applyStripeTestEvent(pending, { ...event, id: 'evt_failed', type: 'checkout.session.async_payment_failed', data: { object: unpaid } }, unpaid);
  assert.equal(failed.status, 'failed');
  const paid = applyStripeTestEvent(failed, { ...event, id: 'evt_later', type: 'checkout.session.async_payment_succeeded' }, session);
  assert.equal(paid.status, 'confirmed');
  assert.equal(applyStripeTestEvent(paid, { ...event, id: 'evt_old_failed', type: 'checkout.session.async_payment_failed', data: { object: unpaid } }, session).status, 'confirmed');
  assert.equal(applyStripeTestEvent(order, { ...event, type: 'checkout.session.expired', data: { object: unpaid } }, { ...unpaid, status: 'expired' }).status, 'cancelled');
});

test('mauvais mode, montant, devise, session ou commande refusés ; données fraîches requises', () => {
  const { order, session, event } = fixtures();
  for (const change of [{ livemode: true }, { amount_total: 1 }, { currency: 'usd' }, { id: 'cs_test_other' },
    { client_reference_id: 'another' }, { mode: 'subscription' }, { payment_intent: null }]) {
    assert.throws(() => applyStripeTestEvent(order, event, { ...session, ...change }));
  }
  assert.throws(() => applyStripeTestEvent(order, { ...event, livemode: true }, session));
  const unpaid = { ...session, payment_status: 'unpaid' };
  assert.equal(applyStripeTestEvent(order, event, unpaid).status, 'pending');
});

test('signature Stripe : corps brut et horodatage contrôlés, altération et relecture ancienne rejetées', () => {
  const client = new Stripe('sk_test_fixture_not_a_real_key');
  const payload = JSON.stringify({ id: 'evt_fixture', object: 'event', livemode: false });
  const secret = 'whsec_local_fixture_not_a_real_key';
  const header = client.webhooks.generateTestHeaderString({ payload, secret });
  assert.equal(client.webhooks.constructEvent(payload, header, secret).id, 'evt_fixture');
  assert.throws(() => client.webhooks.constructEvent(payload + ' ', header, secret));
  const old = client.webhooks.generateTestHeaderString({ payload, secret, timestamp: Math.floor(Date.now() / 1000) - 600 });
  assert.throws(() => client.webhooks.constructEvent(payload, old, secret));
});
