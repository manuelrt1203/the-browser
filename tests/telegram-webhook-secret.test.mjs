import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTelegramWebhookSecret,validTelegramWebhookSecret } from '../src/lib/telegram-webhook-secret.ts';

test('rotation : ancien et nouveau secrets acceptés pendant la transition',()=>{
  const env={TELEGRAM_WEBHOOK_SECRET:'current_fixture_secret',TELEGRAM_WEBHOOK_SECRET_NEXT:'next_fixture_secret'};
  assert.equal(hasTelegramWebhookSecret(env),true);
  assert.equal(validTelegramWebhookSecret(env.TELEGRAM_WEBHOOK_SECRET,env),true);
  assert.equal(validTelegramWebhookSecret(env.TELEGRAM_WEBHOOK_SECRET_NEXT,env),true);
  for(const value of ['','wrong','current_fixture_secre','current_fixture_secret_extra'])assert.equal(validTelegramWebhookSecret(value,env),false);
});
test('rotation : après remplacement, seul le nouveau secret reste accepté',()=>{
  const env={TELEGRAM_WEBHOOK_SECRET:'next_fixture_secret'};
  assert.equal(validTelegramWebhookSecret('current_fixture_secret',env),false);
  assert.equal(validTelegramWebhookSecret('next_fixture_secret',env),true);
  assert.equal(hasTelegramWebhookSecret({}),false);assert.equal(validTelegramWebhookSecret('',{}),false);
});
