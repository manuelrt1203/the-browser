import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPremiumChannel } from '../scripts/check-premium-channel.mjs';

const env = { TELEGRAM_BOT_TOKEN: 'test-fixture-token', TELEGRAM_CHANNEL_ID: '-10012345', TELEGRAM_PREMIUM_CHANNEL_ID: '-10067890' };
function api({ member = {}, chat = {}, bot = {} } = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    const method = url.split('/').at(-1);
    calls.push({ method, body: JSON.parse(options.body) });
    assert.equal(options.method, 'POST');
    const results = {
      getMe: { id: 123, is_bot: true, username: 'Thebrowser365_bot', ...bot },
      getChat: { id: -10067890, type: 'channel', ...chat },
      getChatMember: { status: 'administrator', can_invite_users: true, can_restrict_members: true, ...member },
    };
    assert.ok(method in results, 'Aucune opération modifiant Telegram ne doit être appelée');
    return Response.json({ ok: true, result: results[method] });
  };
  return { calls, fetcher };
}

test('contrôle du canal privé : uniquement trois lectures et toutes les permissions requises', async () => {
  const { calls, fetcher } = api();
  const result = await checkPremiumChannel(env, fetcher);
  assert.equal(result.ready, true);
  assert.deepEqual(calls.map(c => c.method), ['getMe', 'getChat', 'getChatMember']);
  assert.deepEqual(calls[2].body, { chat_id: env.TELEGRAM_PREMIUM_CHANNEL_ID, user_id: 123 });
});

test('canal public, groupe, mauvais bot ou identifiant incohérent refusés', async () => {
  for (const change of [{ chat: { username: 'public' } }, { chat: { type: 'supergroup' } },
    { chat: { id: -100999 } }, { bot: { username: 'other_bot' } }]) {
    await assert.rejects(() => checkPremiumChannel(env, api(change).fetcher));
  }
  await assert.rejects(() => checkPremiumChannel({ ...env, TELEGRAM_PREMIUM_CHANNEL_ID: env.TELEGRAM_CHANNEL_ID }));
});

test('permission absente : canal pas prêt, sans tentative de correction automatique', async () => {
  for (const member of [{ status: 'member' }, { can_invite_users: false }, { can_restrict_members: false }]) {
    const result = await checkPremiumChannel(env, api({ member }).fetcher);
    assert.equal(result.ready, false);
  }
});

test('configuration absente ou échec API : aucune valeur du jeton dans les erreurs', async () => {
  await assert.rejects(() => checkPremiumChannel({}));
  for (const response of [new Response('not json'), Response.json({ ok: false, description: env.TELEGRAM_BOT_TOKEN })]) {
    await assert.rejects(() => checkPremiumChannel(env, async () => response), e => !e.message.includes(env.TELEGRAM_BOT_TOKEN));
  }
  await assert.rejects(() => checkPremiumChannel(env, async () => { throw new Error(env.TELEGRAM_BOT_TOKEN); }), e => !e.message.includes(env.TELEGRAM_BOT_TOKEN));
});
