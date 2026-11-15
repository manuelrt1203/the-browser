import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Read-only Bot API calls. Never registers a webhook, sends a message or creates an invite. */
export async function checkPremiumChannel(env = process.env, fetcher = fetch) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const channelId = env.TELEGRAM_PREMIUM_CHANNEL_ID;
  const publicId = env.TELEGRAM_CHANNEL_ID;
  if (!token || !channelId || !publicId) {
    throw new Error('Configurer TELEGRAM_BOT_TOKEN, TELEGRAM_PREMIUM_CHANNEL_ID et TELEGRAM_CHANNEL_ID côté serveur.');
  }
  if (!/^-100[1-9]\d*$/.test(channelId) || !/^-100[1-9]\d*$/.test(publicId) || channelId === publicId) {
    throw new Error('Le canal Premium doit avoir un identifiant numérique distinct du canal public.');
  }
  async function telegram(method, body = {}) {
    try {
      const response = await fetcher(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !data.result) throw new Error();
      return data.result;
    } catch { throw new Error(`Échec Telegram ${method} ; détails masqués pour protéger le jeton.`); }
  }
  const bot = await telegram('getMe');
  if (!bot.is_bot || !Number.isSafeInteger(bot.id) || bot.username?.toLowerCase() !== 'thebrowser365_bot') {
    throw new Error('Le jeton doit correspondre à @Thebrowser365_bot.');
  }
  const chat = await telegram('getChat', { chat_id: channelId });
  if (String(chat.id) !== channelId || chat.type !== 'channel' || chat.username) {
    throw new Error('Le canal Premium doit être un canal privé correspondant à cet identifiant.');
  }
  const member = await telegram('getChatMember', { chat_id: channelId, user_id: bot.id });
  const administrator = member.status === 'administrator';
  const canInvite = administrator && member.can_invite_users === true;
  const canRestrict = administrator && member.can_restrict_members === true;
  return { ready: administrator && canInvite && canRestrict, bot: bot.username,
    channelId, privateChannel: true, administrator, canInvite, canRestrict };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await checkPremiumChannel();
    console.log(JSON.stringify(result));
    if (!result.ready) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
