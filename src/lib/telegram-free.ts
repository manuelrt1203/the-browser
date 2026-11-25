import {randomBytes} from "node:crypto";
import {premiumRedisCommand} from "./premium-redis.ts";
import {readChannelState, type ChannelPost} from "./telegram-store.ts";
import {resolvePublication, RESOLUTION_VERSION, type Reference} from "./telegram-resolution.ts";
import {telegramMessageUrl} from "./catalogue-links.ts";
import {FREE_BOT, freeAssetUrl, telegramFreeEnabled, validFreeToken} from "./telegram-free-links.ts";

type Bot = (method: string, body: Record<string, unknown>) => Promise<Record<string, unknown>>;
type Media = {file_id?: string; file_unique_id?: string; file_name?: string; mime_type?: string};
type Message = {message_id?: number; chat?: {id?: number; type?: string}; from?: {id?: number; is_bot?: boolean}; text?: string; caption?: string;
  video?: Media; document?: Media; media_group_id?: string; forward_origin?: {type?: string; chat?: {id?: number}; message_id?: number}; reply_to_message?: Message};
type Update = {update_id?: number; message?: Message; callback_query?: {id?: string; from?: {id?: number; is_bot?: boolean}; message?: Message; data?: string}};
type Asset = {token: string; source: string; owner: number; mode: "publish" | "replace"; status: "draft" | "publishing" | "published" | "uncertain" | "cancelled" | "disabled";
  fileId: string; fileType: "video" | "document"; fileName: string; caption: string; poster: string | null; titles: Reference[]; originalMessageId?: number; publicMessageId?: number; publicDate?: number};
type Dependencies = {redis: typeof premiumRedisCommand; bot: Bot; catalogue: typeof readChannelState; resolve: typeof resolvePublication; poster: (ref: Reference) => Promise<string | null>; now: () => number};
const positive = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n > 0;
const mediaName = (s: unknown): s is string => typeof s === "string" && /\.(mp4|mkv|avi|mov|webm|m4v|mpeg|mpg|ts)$/i.test(s.trim());
const short = (s: string, length = 350) => Array.from(s).slice(0, length).join("");
const prefixFor = (source: string) => `the-browser:{telegram-free:${source}}:`;
export class FreeBotFailure extends Error {
  readonly seconds: number;
  constructor(readonlyCode: "uncertain" | "rejected" | "rate", seconds = 0) {super(readonlyCode); this.seconds = seconds;}
}
async function bot(method: string, body: Record<string, unknown>) {
  let response, value;
  try {
    response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(40_000)});
    value = await response.json();
  } catch {throw new FreeBotFailure("uncertain");}
  if (!response.ok || !value?.ok) {
    if (response.status === 429 && positive(value?.parameters?.retry_after)) throw new FreeBotFailure("rate", value.parameters.retry_after);
    throw new FreeBotFailure("rejected");
  }
  return value.result as Record<string, unknown>;
}
async function poster(ref: Reference) {
  const r = await fetch(`https://api.themoviedb.org/3/${ref.kind === "serie" ? "tv" : "movie"}/${ref.id}?language=fr-FR`, {headers: {Authorization: `Bearer ${process.env.TMDB_READ_TOKEN ?? ""}`}, redirect: "error", signal: AbortSignal.timeout(15_000)});
  if (!r.ok) throw new Error("POSTER_UNAVAILABLE");
  const detail = await r.json();
  if (detail.id !== ref.id) throw new Error("POSTER_MISMATCH");
  return /^\/[A-Za-z0-9_.-]+$/.test(detail.poster_path ?? "") ? `https://image.tmdb.org/t/p/w780${detail.poster_path}` : null;
}
function manifest(asset: Asset): ChannelPost {
  if (!positive(asset.publicMessageId) || !positive(asset.publicDate)) throw new Error("PUBLICATION_MISSING");
  return {messageId: asset.publicMessageId, version: asset.publicDate, updateId: 0, text: asset.caption, fileName: asset.fileName, titles: asset.titles,
    pending: [], resolutionVersion: RESOLUTION_VERSION, freeAccessToken: asset.token};
}
export async function freePublicPosts(env = process.env, redis = premiumRedisCommand): Promise<Record<string, ChannelPost>> {
  if (!telegramFreeEnabled(env)) return {};
  const source = env.TELEGRAM_CHANNEL_ID!, values = await redis(["HGETALL", prefixFor(source) + "public"]);
  if (!Array.isArray(values) || values.length % 2) throw new Error("FREE_INDEX_INVALID");
  const posts: Record<string, ChannelPost> = {};
  for (let i = 0; i < values.length; i += 2) {
    const p = JSON.parse(String(values[i + 1])) as ChannelPost;
    if (String(p.messageId) !== values[i] || !positive(p.messageId) || !validFreeToken(p.freeAccessToken) || !Array.isArray(p.titles)) throw new Error("FREE_INDEX_INVALID");
    posts[`${source}:${p.messageId}`] = p;
  }
  return posts;
}
/** Maintenance-only read diagnostic. Never posts, edits, forwards or sends files. */
export async function telegramFreeReadiness(env = process.env) {
  const source = env.TELEGRAM_CHANNEL_ID!;
  const me = await bot("getMe", {}), chat = await bot("getChat", {chat_id: source});
  const member = await bot("getChatMember", {chat_id: source, user_id: me.id});
  const publicPosts = await freePublicPosts(env), state = await readChannelState();
  const sourceVerified = String(chat.id) === source && chat.type === "channel" && typeof chat.username === "string";
  const botVerified = me.username === FREE_BOT && member.status === "administrator";
  const canPublish = member.can_post_messages === true, canReplace = member.can_edit_messages === true;
  return {enabled: telegramFreeEnabled(env), ready: telegramFreeEnabled(env) && sourceVerified && botVerified && canPublish && canReplace,
    sourceVerified, botVerified, canPublish, canReplace, protectedContent: chat.has_protected_content === true,
    gatedPublications: Object.keys(publicPosts).length,
    legacyPublicMedia: Object.entries(state.posts).filter(([k, p]) => !publicPosts[k] && mediaName(p.fileName ?? p.text)).length};
}

export function telegramFreeService(overrides: Partial<Dependencies> = {}, env = process.env) {
  const d: Dependencies = {redis: premiumRedisCommand, bot, catalogue: readChannelState, resolve: resolvePublication, poster, now: Date.now, ...overrides};
  const source = env.TELEGRAM_CHANNEL_ID!, prefix = prefixFor(source);
  const key = (token: string) => {if (!validFreeToken(token)) throw new Error("TOKEN_INVALID"); return prefix + "asset:" + token;};
  const reply = (user: number, text: string, reply_markup?: unknown) => ({method: "sendMessage", chat_id: user, text, ...(reply_markup ? {reply_markup} : {})});
  const answer = (id: string, text: string) => ({method: "answerCallbackQuery", callback_query_id: id, text, show_alert: true});
  async function asset(token: string) {
    const raw = await d.redis(["GET", key(token)]);
    if (raw === null) return null;
    const value = JSON.parse(String(raw)) as Asset;
    if (value.token !== token || value.source !== source || !positive(value.owner) || !["video", "document"].includes(value.fileType) || typeof value.fileId !== "string") throw new Error("ASSET_INVALID");
    return value;
  }
  async function owner(user: number) {return (await d.bot("getChatMember", {chat_id: source, user_id: user})).status === "creator";}
  async function channelUrl() {
    const chat = await d.bot("getChat", {chat_id: source});
    if (String(chat.id) !== source || chat.type !== "channel" || typeof chat.username !== "string" || !/^[A-Za-z0-9_]{5,32}$/.test(chat.username)) throw new Error("PUBLIC_CHANNEL_REQUIRED");
    return `https://t.me/${chat.username}`;
  }
  async function rate(user: number) {
    const count = await d.redis(["EVAL", "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n", 1, prefix + "rate:" + user]);
    if (!positive(count)) throw new Error("RATE_UNAVAILABLE");
    return count <= 12;
  }
  async function deliver(user: number, target: string, updateId: number, callback?: string) {
    const callbackReply = (text: string) => callback ? answer(callback, text) : reply(user, text);
    if (!await rate(user)) return callbackReply("Trop de demandes. Patientez une minute avant de réessayer.");
    const legacy = target.match(/^post_([1-9]\d{0,12})$/);
    let file: Asset | null = null, publicUrl: string | null = null;
    if (legacy) {
      const id = Number(legacy[1]), post = (await d.catalogue()).posts[`${source}:${id}`];
      if (!post || post.messageId !== id || !mediaName(post.fileName ?? post.text)) return callbackReply("Cette publication n’est pas disponible. Retrouvez le titre dans le catalogue.");
      const protectedPost = await d.redis(["HGET", prefix + "public", String(id)]);
      if (typeof protectedPost === "string") {
        const token = (JSON.parse(protectedPost) as ChannelPost).freeAccessToken;
        if (!validFreeToken(token)) throw new Error("FREE_INDEX_INVALID");
        file = await asset(token);
        if (!file || file.status !== "published") return callbackReply("Cet accès gratuit n’est pas disponible.");
      } else {
        // Legacy videos remain public; never copy/forward protected content.
        publicUrl = telegramMessageUrl(source, id);
      }
    } else {
      if (!validFreeToken(target)) return callbackReply("Ce lien est invalide.");
      file = await asset(target);
      if (!file || file.status !== "published") return callbackReply("Ce fichier n’est pas disponible pour le moment.");
    }
    const member = await d.bot("getChatMember", {chat_id: source, user_id: user});
    const joined = ["member", "administrator", "creator"].includes(String(member.status)) || (member.status === "restricted" && member.is_member === true);
    if (!joined) {
      if (callback) return answer(callback, "Rejoignez d’abord le canal avec le bouton « Rejoindre », puis vérifiez à nouveau.");
      return reply(user, "Rejoignez gratuitement le canal The Browser, puis appuyez sur « J’ai rejoint ». Aucun paiement n’est demandé.", {inline_keyboard: [
        [{text: "Rejoindre le canal gratuitement", url: await channelUrl()}], [{text: "J’ai rejoint · Vérifier", callback_data: `free_get_${target}`}],
      ]});
    }
    if (file && (await asset(file.token))?.status !== "published") return callbackReply("Cet accès gratuit a été désactivé.");
    const delivery = prefix + `delivery:${user}:${updateId}`;
    if (await d.redis(["SET", delivery, "sending", "NX", "EX", 86400]) !== "OK") return callbackReply("Cette demande a déjà été traitée. Vérifiez votre conversation.");
    try {
      const result = file ? await d.bot(file.fileType === "video" ? "sendVideo" : "sendDocument", {chat_id: user,
        [file.fileType]: file.fileId, caption: short(file.fileName), disable_notification: true})
        : await d.bot("sendMessage", {chat_id: user, text: "Votre adhésion est vérifiée. Ouvrez cette vidéo dans le canal gratuit.", reply_markup: {inline_keyboard: [[{text: "Ouvrir la vidéo dans le canal", url: publicUrl}]]}});
      if (!positive(result.message_id)) throw new FreeBotFailure("uncertain");
      await d.redis(["SET", delivery, "sent", "EX", 86400]);
      return callback ? answer(callback, "Votre accès gratuit est vérifié. Retrouvez la vidéo dans cette conversation.") : {ok: true};
    } catch (error) {
      // Explicit rejections did not send a message; ambiguous network results
      // keep the reservation so retries of this update never send twice.
      if (error instanceof FreeBotFailure && error.message !== "uncertain") await d.redis(["DEL", delivery]);
      return callbackReply("L’envoi n’a pas pu être confirmé. Vérifiez la conversation avant de faire une nouvelle demande.");
    }
  }
  async function draft(user: number, message: Message, mode: Asset["mode"], extra: string) {
    if (!await rate(user)) return reply(user, "Trop de demandes. Patientez une minute avant de réessayer.");
    if (!await owner(user)) return reply(user, "Cette commande est réservée au propriétaire du canal public.");
    const mediaMessage = message.reply_to_message, media = mediaMessage?.video ?? mediaMessage?.document;
    if (!media || typeof media.file_id !== "string" || !/^[A-Za-z0-9_-]{10,1024}$/.test(media.file_id)) return reply(user, "Envoyez ou transférez le fichier au bot en privé, puis répondez à ce fichier avec /publiergratuit. Pour une ancienne publication : /protegergratuit suivi de son lien, en réponse au fichier original.");
    if (mediaMessage?.forward_origin?.type === "channel" && String(mediaMessage.forward_origin.chat?.id) !== source) return reply(user, "Utilisez un fichier original ou une publication du canal public The Browser. Un autre canal, notamment Premium, ne peut pas être publié ici par cette commande.");
    const fileName = short(media.file_name ?? "video.mp4", 180);
    if (!mediaMessage?.video && !mediaName(fileName)) return reply(user, "Cette commande attend une vidéo, envoyée comme vidéo ou comme fichier.");
    const canonical = prefix + `draft:${user}:${mediaMessage!.message_id}:${mode}`;
    const known = await d.redis(["GET", canonical]);
    if (typeof known === "string") return preview(user, (await asset(known))!);
    let originalMessageId: number | undefined, titles: Reference[];
    const inputText = mediaMessage?.caption || fileName;
    if (mode === "replace") {
      const origin = mediaMessage?.forward_origin;
      const url = extra.match(/^https:\/\/t\.me\/TheBrowser365\/([1-9]\d*)(?:\?.*)?$/i);
      originalMessageId = url ? Number(url[1]) : origin?.type === "channel" && String(origin.chat?.id) === source ? origin.message_id : undefined;
      const existing = positive(originalMessageId) ? (await d.catalogue()).posts[`${source}:${originalMessageId}`] : undefined;
      if (!existing || !mediaName(existing.fileName ?? "") || existing.fileName !== fileName) return reply(user, "Répondez au fichier original avec /protegergratuit https://t.me/TheBrowser365/ID. Le nom du fichier doit correspondre à la publication enregistrée. Aucun message n’a été modifié.");
      if (mediaMessage?.media_group_id && mediaMessage.document) return reply(user, "Un document d’album ne peut pas être remplacé par une affiche. Utilisez /publiergratuit pour créer une nouvelle annonce ; l’ancien message restera intact.");
      titles = existing.titles;
    } else {
      const parsed = await d.resolve({text: [inputText, extra].filter(Boolean).join("\n"), fileName});
      if (parsed.review.length || parsed.titles.length > 1) return reply(user, "Le titre ou l’épisode est ambigu. Ajoutez un lien TMDB et la numérotation précise à la commande, puis réessayez. Rien n’a été publié.");
      titles = parsed.titles;
    }
    const image = titles[0] ? await d.poster(titles[0]) : null;
    if (mode === "replace" && !image) return reply(user, "Aucune affiche fiable n’est disponible pour remplacer cette vidéo. Rien n’a été modifié.");
    const tmdb = titles[0] ? `\nhttps://www.themoviedb.org/${titles[0].kind === "serie" ? "tv" : "movie"}/${titles[0].id}` : "";
    const value: Asset = {token: randomBytes(18).toString("base64url"), source, owner: user, mode, status: "draft", fileId: media.file_id,
      fileType: mediaMessage?.video ? "video" : "document", fileName, titles, poster: image, caption: `${short(inputText)}${tmdb}\n\nAccès gratuit via le bot · Rejoignez le canal pour recevoir le fichier.`, ...(originalMessageId ? {originalMessageId} : {})};
    const selected = await d.redis(["EVAL", "local p=redis.call('GET',KEYS[1]);if p then return p end;redis.call('SET',KEYS[2],ARGV[2]);redis.call('SET',KEYS[1],ARGV[1]);return ARGV[1]", 2, canonical, key(value.token), value.token, JSON.stringify(value)]);
    return preview(user, selected === value.token ? value : (await asset(String(selected)))!);
  }
  function preview(user: number, file: Asset) {
    if (file.status !== "draft") return reply(user, file.status === "published" ? `Déjà publiée : ${telegramMessageUrl(source, file.publicMessageId!)}` : "Cette demande est déjà traitée ou nécessite une vérification. Aucun nouvel envoi automatique.");
    return reply(user, `${file.mode === "replace" ? `Remplacer le fichier public par son affiche :\n${telegramMessageUrl(source, file.originalMessageId!)}` : "Publier une annonce dans le canal gratuit"}\n\nFichier : ${file.fileName}\n${file.caption}\n\nLe fichier est conservé pour le bot. ${file.mode === "replace" ? "Après confirmation, il sera retiré de ce message public et remplacé par l’affiche." : "Seuls l’annonce et le bouton seront publiés ; la vidéo restera dans le bot."}`, {inline_keyboard: [
      [{text: file.mode === "replace" ? "Remplacer la vidéo par l’affiche" : "Publier l’annonce gratuite", callback_data: `free_publish_${file.token}`}], [{text: "Annuler", callback_data: `free_cancel_${file.token}`}],
    ]});
  }
  async function publish(token: string, user: number) {
    const file = await asset(token);
    if (!file || file.owner !== user || file.status !== "draft" || !await owner(user)) return;
    file.status = "publishing";
    const reserved = await d.redis(["EVAL", "if redis.call('EXISTS',KEYS[2])==1 then return 0 end;local r=redis.call('GET',KEYS[1]);if not r then return 0 end;local a=cjson.decode(r);if a.status~='draft' or a.owner~=tonumber(ARGV[1]) then return 0 end;redis.call('SET',KEYS[2],'started');redis.call('SET',KEYS[1],ARGV[2]);return 1", 2, key(token), prefix + "publish:" + token, user, JSON.stringify(file)]);
    if (reserved !== 1) return;
    let sent = false;
    try {
      const reply_markup = {inline_keyboard: [[{text: "Regarder / Télécharger · Gratuit", url: freeAssetUrl(token)}]]};
      const result = file.mode === "replace" ? await d.bot("editMessageMedia", {chat_id: source, message_id: file.originalMessageId, media: {type: "photo", media: file.poster, caption: file.caption}, reply_markup})
        : await d.bot(file.poster ? "sendPhoto" : "sendMessage", {chat_id: source, ...(file.poster ? {photo: file.poster, caption: file.caption} : {text: file.caption}), reply_markup, disable_notification: true});
      const chat = result.chat as {id?: number} | undefined;
      if (String(chat?.id) !== source || !positive(result.message_id) || !positive(result.edit_date ?? result.date) || result.video || result.document) throw new FreeBotFailure("uncertain");
      sent = true;
      file.publicMessageId = result.message_id; file.publicDate = Number(result.edit_date ?? result.date); file.status = "published";
      await d.redis(["EVAL", "redis.call('SET',KEYS[1],ARGV[1]);redis.call('HSET',KEYS[2],ARGV[2],ARGV[3]);return 1", 2, key(token), prefix + "public", JSON.stringify(file), String(file.publicMessageId), JSON.stringify(manifest(file))]);
      await d.bot("sendMessage", {chat_id: user, text: `Accès gratuit publié : ${telegramMessageUrl(source, file.publicMessageId)}`, reply_markup: {inline_keyboard: [[{text: "Désactiver cet accès gratuit", callback_data: `free_disable_${token}`}]]}}).catch(() => {});
    } catch (error) {
      if (!sent && error instanceof FreeBotFailure && error.message !== "uncertain") {
        // A definitive Telegram rejection did not publish or edit anything.
        // Only a new, explicit owner confirmation may retry this draft.
        file.status = "draft";
        await d.redis(["EVAL", "redis.call('SET',KEYS[1],ARGV[1]);redis.call('DEL',KEYS[2]);return 1", 2, key(token), prefix + "publish:" + token, JSON.stringify(file)]);
        await d.bot("sendMessage", {chat_id: user, text: error.seconds ? `Telegram limite les envois. Patientez ${error.seconds} secondes, puis confirmez à nouveau l’aperçu.` : "Telegram a refusé la publication. Rien n’a été modifié. Vérifiez les droits du bot et l’affiche, puis confirmez à nouveau l’aperçu."}).catch(() => {});
        return;
      }
      if (!sent) {file.status = "uncertain"; await d.redis(["SET", key(token), JSON.stringify(file)]);}
      await d.bot("sendMessage", {chat_id: user, text: `Publication non confirmée. Le fichier est conservé ; aucun envoi ne sera répété automatiquement. Vérifiez le canal avant toute nouvelle demande. Référence : ${token}`}).catch(() => {});
    }
  }
  async function command(update: Update): Promise<{reply: Record<string, unknown>; work?: () => Promise<void>; changed?: boolean} | null> {
    if (!telegramFreeEnabled(env) || !Number.isSafeInteger(update.update_id)) return null;
    const m = update.message, c = update.callback_query;
    const actor = m?.from ?? c?.from, chat = m?.chat ?? c?.message?.chat;
    if (!positive(actor?.id) || actor.is_bot || chat?.type !== "private" || chat.id !== actor.id) return null;
    const user = actor.id;
    const start = m?.text?.match(/^\/start(?:@Thebrowser365_bot)? free_([A-Za-z0-9_-]{1,40})$/i);
    const get = c?.data?.match(/^free_get_([A-Za-z0-9_-]{1,40})$/);
    if (get && (typeof c?.id !== "string" || c.id.length > 200)) return null;
    if (start || get) return {reply: await deliver(user, (start ?? get)![1], update.update_id!, get ? c!.id : undefined)};
    const create = m?.text?.match(/^\/(publiergratuit|protegergratuit)(?:@Thebrowser365_bot)?(?:\s+([\s\S]{0,300}))?$/i);
    if (create) return {reply: await draft(user, m!, create[1].toLowerCase() === "protegergratuit" ? "replace" : "publish", create[2]?.trim() ?? "")};
    if (m?.text?.match(/^\/gratuit(?:@Thebrowser365_bot)?$/i)) {
      if (!await rate(user)) return {reply: reply(user, "Patientez une minute avant de réessayer.")};
      const instructions = await owner(user) ? "\nPour publier : envoyez un fichier original ici puis répondez-lui avec /publiergratuit. Pour remplacer une ancienne vidéo, répondez au fichier original avec /protegergratuit suivi du lien public. Un aperçu à confirmer précède chaque modification." : "";
      return {reply: reply(user, `L’accès gratuit demande seulement de rejoindre le canal : ${await channelUrl()}. Ouvrez ensuite un bouton Regarder / Télécharger depuis une publication ou le catalogue.${instructions}`)};
    }
    const action = c?.data?.match(/^free_(publish|cancel|disable)_([A-Za-z0-9_-]{24})$/);
    if (!action || typeof c?.id !== "string" || c.id.length > 200) return null;
    const file = await asset(action[2]);
    if (!file || file.owner !== user || !await owner(user)) return {reply: answer(c.id, "Cette action est réservée au propriétaire qui a préparé cette publication.")};
    if (action[1] === "publish") return {reply: answer(c.id, file.status === "draft" ? "La publication est en cours. Vous recevrez sa confirmation ici." : "Cette demande est déjà prise en charge."), ...(file.status === "draft" ? {work: () => publish(file.token, user)} : {})};
    if (action[1] === "cancel" && file.status === "draft") {
      // Compare-and-set also checks the publish marker: cancellation must never
      // overwrite a concurrent publication reservation.
      const cancelled = await d.redis(["EVAL", "if redis.call('EXISTS',KEYS[2])==1 then return 0 end;local r=redis.call('GET',KEYS[1]);if not r then return 0 end;local a=cjson.decode(r);if a.status~='draft' then return 0 end;redis.call('SET',KEYS[1],ARGV[1]);return 1", 2, key(file.token), prefix + "publish:" + file.token, JSON.stringify({...file, status: "cancelled"})]);
      return {reply: answer(c.id, cancelled === 1 ? "Brouillon annulé. Aucun message public n’a été modifié." : "La publication est déjà prise en charge. Vérifiez le canal avant toute nouvelle demande.")};
    }
    let changed = false;
    if (action[1] === "disable" && file.status === "published") {await d.redis(["EVAL", "redis.call('SET',KEYS[1],ARGV[1]);redis.call('HDEL',KEYS[2],ARGV[2]);return 1", 2, key(file.token), prefix + "public", JSON.stringify({...file, status: "disabled"}), String(file.publicMessageId)]); changed = true;}
    return {changed, reply: answer(c.id, "Demande traitée. Aucun fichier ni message public n’a été supprimé.")};
  }
  return {command, publicPosts: () => freePublicPosts(env, d.redis)};
}
