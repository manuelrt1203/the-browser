import { readFile, writeFile } from 'node:fs/promises';
import { CatalogueStorageError, checkCatalogueStorage, hasCatalogueStorage, saveChannelPost } from '../src/lib/telegram-store.ts';
import { RESOLUTION_VERSION, createResolver, parseCandidate, resolvePublication } from '../src/lib/telegram-resolution.ts';

const [file, exportId, ...flags] = process.argv.slice(2);
const dryRun = flags.includes('--dry-run');
const offline = flags.includes('--offline');
const overridesIndex = flags.indexOf('--overrides');
const overrides = overridesIndex >= 0 ? JSON.parse(await readFile(flags[overridesIndex+1], 'utf8')) : {};
const reportIndex = flags.indexOf('--report');
const reportFile = reportIndex >= 0 ? flags[reportIndex + 1] : '.telegram-import-report.json';
const thresholdIndex = flags.indexOf('--minimum-coverage');
const threshold = thresholdIndex >= 0 ? Number(flags[thresholdIndex + 1]) : undefined;
if (!file || !exportId || !reportFile || (threshold !== undefined && (!Number.isFinite(threshold) || threshold < 0 || threshold > 100))) throw new Error('Usage: node scripts/import-telegram.mjs export.json ID_EXPORT [--dry-run] [--offline] [--report rapport.json] [--minimum-coverage 99]');
if (!offline && (!process.env.TMDB_READ_TOKEN || process.env.TMDB_READ_TOKEN === '[SENSITIVE]')) throw new Error('TMDB_READ_TOKEN requis pour vérifier les fiches avant import. Aucun message modifié.');
if (!dryRun && !offline && !hasCatalogueStorage()) throw new Error('Configurer Redis ou CATALOGUE_DATA_DIR avant import.');
const data = JSON.parse(await readFile(file, 'utf8'));
const chats = data.chats?.list ?? (data.messages ? [data] : []);
const channel = chats.find((chat) => String(chat.id) === exportId && ['public_channel', 'private_channel'].includes(chat.type));
if (!channel) throw new Error('Canal demandé absent de l’export');
const channelId = `-100${channel.id}`;
if (!dryRun && !offline && process.env.TELEGRAM_CHANNEL_ID && channelId !== process.env.TELEGRAM_CHANNEL_ID) throw new Error('ID du canal différent de la configuration. Aucun message modifié.');
const flatten = (text) => Array.isArray(text) ? text.map((part) => typeof part === 'string' ? part : part.text ?? '').join('') : text ?? '';
// Détecter une erreur globale de stockage avant de lancer des centaines de recherches.
if (!dryRun && !offline) {
  try { if (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) await checkCatalogueStorage(); }
  catch (error) {
    console.error(error instanceof CatalogueStorageError ? `${error.code}: ${error.message}` : "Échec du contrôle Redis. Aucun message modifié.");
    process.exit(1);
  }
}
const resolve = createResolver();
const report = { channelId, resolutionVersion:RESOLUTION_VERSION, mode: offline ? 'offline-no-verification' : dryRun ? 'dry-run' : 'import', posts:0, imported:0, unchanged:0, failed:0, mediaPosts:0, resolvedMediaPosts:0, fullyResolvedMediaPosts:0, ownerVerifiedMediaPosts:0, recognizedTitles:[], review:[], errors:[], offlineCandidates:[] };
const unique = new Set();
let next = 0;
let halted = false;
const messages = channel.messages.filter((m) => m.type === 'message');
await Promise.all(Array.from({length: Math.min(3,messages.length)}, async () => {
  while (next < messages.length && !halted) {
    const message = messages[next++];
    report.posts++;
    const caption = flatten(message.text).trim();
    const fileName = message.file_name;
    const text = caption || fileName || '';
    const media = ['video_file','animation'].includes(message.media_type) || /\.(?:mp4|mkv|avi|mov|mpg|mpeg|webm|m4v)$/i.test(fileName ?? '');
    if (media) report.mediaPosts++;
    try {
      if (offline) {
        report.offlineCandidates.push({messageId:message.id, text:caption, fileName, candidates:[...new Map([caption,fileName].filter(Boolean).map(parseCandidate).filter(Boolean).map((c) => [JSON.stringify(c),c])).values()]});
        continue;
      }
      const links = (message.text_entities ?? []).filter((part) => part.type === 'text_link' && part.href).map((part) => part.href);
      const override = overrides[String(message.id)];
      if (override !== undefined) {
        if (typeof override !== 'string' || !/^https:\/\/(?:www\.)?themoviedb\.org\/(?:movie|tv)\/\d+(?:[/?#-].*)?$/.test(override)) throw new Error('Correction manuelle invalide');
        links.push(override);
      }
      const result = await resolvePublication(override !== undefined
        ? { text: override }
        : { text: caption, fileName, links, channelId, messageId: message.id },resolve);
      if (media && result.titles.length) report.resolvedMediaPosts++;
      if (media && result.titles.some((ref) => ref.sourceEpisode?.verifiedBy === 'owner')) report.ownerVerifiedMediaPosts++;
      if (media && result.titles.length && !result.review.length) report.fullyResolvedMediaPosts++;
      for (const title of result.titles) unique.add(`${title.kind}:${title.id}`);
      if (result.review.length) report.review.push({messageId:message.id,text:caption,fileName,issues:result.review});
      const version = Number(message.edited_unixtime ?? message.date_unixtime);
      if (!Number.isSafeInteger(version)) throw new Error('Date de message invalide');
      if (!dryRun) {
        const changed = await saveChannelPost(channelId, {messageId:message.id,version,updateId:-1,text,...(fileName ? {fileName} : {}),resolutionVersion:RESOLUTION_VERSION,titles:result.titles,pending:result.pending,review:result.review},undefined,{reanalyse:true});
        if (changed) report.imported++; else report.unchanged++;
      }
    } catch (error) {
      // Une panne réseau n’est jamais comptée comme un titre absent ni comme un import réussi.
      report.failed++;
      if (error instanceof CatalogueStorageError || (error instanceof Error && error.name === 'TmdbUnavailable')) halted = true;
      report.errors.push({messageId:message.id,phase:error instanceof CatalogueStorageError ? 'storage' : 'resolution',reason:error instanceof CatalogueStorageError || (error instanceof Error && error.name === 'TmdbUnavailable') ? error.message : 'Échec de résolution ou sauvegarde'});
    }
    if (report.posts % 100 === 0) console.error(`Progression : ${report.posts}/${messages.length} publications`);
  }
}));
report.unprocessedPosts = messages.length - report.posts;
report.recognizedTitles = [...unique].sort();
report.review.sort((a,b) => a.messageId-b.messageId);
report.mediaCoveragePercent = offline || !report.mediaPosts ? null : Math.round(10000*report.fullyResolvedMediaPosts/report.mediaPosts)/100;
report.titleCoveragePercent = offline || !report.mediaPosts ? null : Math.round(10000*report.resolvedMediaPosts/report.mediaPosts)/100;
report.precisionPercent = null; // Nécessite une vérité terrain validée, pas le seul succès des requêtes.
report.thresholdMet = threshold === undefined ? null : (!offline && report.mediaCoveragePercent !== null && report.mediaCoveragePercent >= threshold && report.failed === 0 && report.unprocessedPosts === 0);
await writeFile(reportFile,JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({channelId,mode:report.mode,posts:report.posts,imported:report.imported,unchanged:report.unchanged,failed:report.failed,unprocessedPosts:report.unprocessedPosts,uniqueTitles:unique.size,mediaPosts:report.mediaPosts,fullyResolvedMediaPosts:report.fullyResolvedMediaPosts,ownerVerifiedMediaPosts:report.ownerVerifiedMediaPosts,mediaCoveragePercent:report.mediaCoveragePercent,titleCoveragePercent:report.titleCoveragePercent,precisionPercent:null,reviewPosts:report.review.length,thresholdMet:report.thresholdMet,report:reportFile}));
// Invalider le cache après l’import si la configuration du site est disponible.
if (!offline && !dryRun && report.imported > 0 && process.env.SITE_URL && process.env.TELEGRAM_WEBHOOK_SECRET) {
  try {
    const url = new URL('/api/telegram/revalidate',process.env.SITE_URL);
    if (url.protocol !== 'https:') throw new Error('HTTPS requis');
    const response = await fetch(url,{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':process.env.TELEGRAM_WEBHOOK_SECRET},signal:AbortSignal.timeout(20_000)});
    if (!response.ok) throw new Error('Cache non invalidé');
    console.error('Cache du site invalidé.');
  } catch { console.error('Import sauvegardé ; cache du site non invalidé. Réessayer le contrôle après déploiement.'); process.exitCode=1; }
}
if (report.failed || (threshold !== undefined && !report.thresholdMet)) process.exitCode=1;
