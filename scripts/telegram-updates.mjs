/** Telegram omits allowed_updates when the standard all-updates subscription applies. */
export function premiumTelegramUpdates(existing, authEnabled, accessEnabled = false) {
  if (existing === undefined || (Array.isArray(existing) && existing.length === 0)) return [];
  if (!Array.isArray(existing) || existing.some(value => typeof value !== 'string')) {
    throw new Error('Types de notifications Telegram inconnus ; webhook inchangé.');
  }
  return [...new Set([...existing, 'channel_post', 'edited_channel_post', ...(authEnabled ? ['message', 'callback_query'] : []), ...(accessEnabled ? ['chat_join_request'] : [])])];
}
