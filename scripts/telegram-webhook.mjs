// Aucun jeton n’est imprimé, y compris en cas d’erreur réseau.
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const channelId = process.env.TELEGRAM_CHANNEL_ID;
const origin = process.env.SITE_URL;
if (!token || !secret || !channelId || !origin) throw new Error('Définir TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_CHANNEL_ID et SITE_URL côté serveur.');
const url = new URL('/api/telegram', origin);
if (url.protocol !== 'https:') throw new Error('SITE_URL doit utiliser HTTPS.');
if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) throw new Error('Format du secret webhook incompatible avec Telegram.');
async function telegram(method, body = {}) {
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), signal:AbortSignal.timeout(20_000),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error('refus');
    return result.result;
  } catch { throw new Error(`Échec Telegram ${method} (détails masqués pour protéger le jeton).`); }
}
const me = await telegram('getMe');
if (me.username?.toLowerCase() !== 'thebrowser365_bot') throw new Error('Le jeton ne correspond pas à @Thebrowser365_bot.');
const chat = await telegram('getChat', {chat_id:channelId});
if (chat.type !== 'channel' || chat.username?.toLowerCase() !== 'thebrowser365') throw new Error('Le canal ne correspond pas à @TheBrowser365.');
const member = await telegram('getChatMember', {chat_id:channelId,user_id:me.id});
if (!['creator','administrator'].includes(member.status)) throw new Error('Le bot doit être administrateur du canal.');
const info = await telegram('getWebhookInfo');
if (process.argv.includes('--register')) {
  if (info.url && info.url !== url.toString() && !process.argv.includes('--replace')) throw new Error('Un autre webhook existe : vérifier sa fonction avant de passer --replace.');
  const health = await fetch(url, { headers:{'X-Telegram-Bot-Api-Secret-Token':secret}, signal:AbortSignal.timeout(20_000) });
  if (!health.ok) throw new Error('Le stockage ou le secret du site ne sont pas prêts ; webhook inchangé.');
  await telegram('setWebhook', {url:url.toString(),secret_token:secret,allowed_updates:['channel_post','edited_channel_post'],drop_pending_updates:false});
}
const current = await telegram('getWebhookInfo');
console.log(JSON.stringify({bot:me.username,channel:chat.username,expectedWebhook:url.toString(),webhookMatches:current.url===url.toString(),pendingUpdates:current.pending_update_count,hasDeliveryError:Boolean(current.last_error_date)}));
