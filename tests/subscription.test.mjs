import test from 'node:test';
import assert from 'node:assert/strict';
import { PREMIUM_OFFERS, monthlyExpiry, createPremiumOrder, confirmPremiumPayment, hasPremiumAccess } from '../src/lib/subscription.ts';

function payment(order, overrides = {}) {
  return { orderId: order.id, provider: order.provider, paymentId: 'payment-1', amountMinor: order.amountMinor,
    currency: order.currency, paidAt: '2026-11-10T14:30:00.000Z', ...overrides };
}

test('offres historiques : 3000 francs XAF et 457 centimes EUR, sans conversion flottante au paiement', () => {
  assert.equal(PREMIUM_OFFERS.saspay.amountMinor, 3000);
  assert.equal(PREMIUM_OFFERS.stripe.amountMinor, 457);
  assert.equal(createPremiumOrder('o', 'stripe').currency, 'EUR');
});

test('échéance : même date et heure UTC, fin de mois et année bissextile', () => {
  for (const [start, end] of [
    ['2026-11-10T14:30:00.123Z', '2026-12-10T14:30:00.123Z'],
    ['2026-01-31T12:00:00.000Z', '2026-02-28T12:00:00.000Z'],
    ['2028-01-31T12:00:00.000Z', '2028-02-29T12:00:00.000Z'],
    ['2026-03-31T12:00:00.000Z', '2026-04-30T12:00:00.000Z'],
    ['2026-12-30T12:00:00.000Z', '2027-01-30T12:00:00.000Z'],
  ]) assert.equal(monthlyExpiry(new Date(start)).toISOString(), end);
  assert.throws(() => monthlyExpiry(new Date('invalid')));
});

test('seul un paiement confirmé ouvre les droits, jamais pending, failed ou cancelled', () => {
  const order = createPremiumOrder('order-1', 'saspay');
  for (const status of ['pending', 'failed', 'cancelled']) {
    assert.equal(hasPremiumAccess({ ...order, status }, new Date('2026-11-10T15:00Z')), false);
  }
  const confirmed = confirmPremiumPayment(order, payment(order));
  assert.equal(hasPremiumAccess(confirmed, new Date('2026-11-10T14:30:00Z')), true);
  assert.equal(hasPremiumAccess(confirmed, new Date('2026-11-10T14:29:59Z')), false);
  assert.equal(hasPremiumAccess(confirmed, new Date('2026-12-10T14:30:00Z')), false);
});

test('confirmation répétée : aucun nouveau mois attribué', () => {
  const order = createPremiumOrder('order-1', 'saspay');
  const confirmed = confirmPremiumPayment(order, payment(order));
  const replay = confirmPremiumPayment(confirmed, payment(order, { paidAt: '2026-11-11T15:00:00Z' }));
  assert.strictEqual(replay, confirmed);
  assert.throws(() => confirmPremiumPayment(confirmed, payment(order, { paymentId: 'other-payment' })));
});

test('paiement : rejette mauvais montant, devise, commande, prestataire, identifiant vide et date invalide', () => {
  const order = createPremiumOrder('order-1', 'saspay');
  for (const change of [{ amountMinor: 1 }, { currency: 'EUR' }, { provider: 'stripe' },
    { orderId: 'another-order' }, { paymentId: '' }, { paidAt: 'invalid' }]) {
    assert.throws(() => confirmPremiumPayment(order, payment(order, change)));
  }
});
