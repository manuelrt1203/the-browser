import { readFile } from 'node:fs/promises';
import { requestedTitles } from '../src/data/selection.ts';
import { hasCatalogueStorage, cleanTelegramTitle, matchKnownTitle, parseChannelText, saveChannelPost } from '../src/lib/telegram-store.ts';

// Ne lire que le canal sélectionné, jamais left_chats ou les conversations privées.
const [file, exportId] = process.argv.slice(2);
if (!file || !exportId || !hasCatalogueStorage()) throw new Error('Configurer le stockage puis : node --experimental-strip-types scripts/import-telegram.mjs export.json ID_EXPORT');
const data = JSON.parse(await readFile(file, 'utf8'));
const chats = data.chats?.list ?? (data.messages ? [data] : []);
const channel = chats.find((chat) => String(chat.id) === exportId && ['public_channel', 'private_channel'].includes(chat.type));
if (!channel) throw new Error('Canal demandé absent de l’export');
const channelId = `-100${channel.id}`;
const flatten = (text) => Array.isArray(text) ? text.map((part) => typeof part === 'string' ? part : part.text ?? '').join('') : text ?? '';
let imported = 0, linked = 0, pending = 0;
for (const message of channel.messages) {
  if (message.type !== 'message') continue;
  const text = flatten(message.text).trim() || message.file_name || '';
  const parsed = parseChannelText(text);
  const unresolved = [];
  for (const line of parsed.pending) {
    const title = matchKnownTitle(line, requestedTitles);
    if (title) parsed.titles.push(title);
    else unresolved.push(cleanTelegramTitle(line) || line);
  }
  parsed.pending = unresolved;
  const version = Number(message.edited_unixtime ?? message.date_unixtime);
  if (!Number.isSafeInteger(version)) throw new Error('Date de message invalide');
  const changed = await saveChannelPost(channelId, {messageId:message.id, version, updateId:-1, text, ...parsed});
  if (changed) imported++;
  linked += parsed.titles.length;
  pending += unresolved.length;
}
console.log(JSON.stringify({ channelId, imported, linkedReferences:linked, unresolvedLines:pending }));
