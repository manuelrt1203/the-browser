import { limitedRequestBody, requestBodyErrorResponse } from "@/lib/request-body";
import { premiumChannelAccessEnabled, withChannelAccess } from "@/lib/premium-channel-access";
import { revalidateTag } from "next/cache";
import { hasCatalogueStorage, readChannelState, saveChannelPost } from "@/lib/telegram-store";

import { RESOLUTION_VERSION, resolvePublication } from "@/lib/telegram-resolution";
import { premiumTelegramReply } from "@/lib/premium-auth";
import { hasTelegramWebhookSecret, validTelegramWebhookSecret } from "@/lib/telegram-webhook-secret";
import { after } from "next/server";
import { telegramCopyService } from "@/lib/telegram-copy";

export const maxDuration = 300;

export async function POST(request: Request) {
  const channel = process.env.TELEGRAM_CHANNEL_ID;
  if (!hasTelegramWebhookSecret() || !channel || !hasCatalogueStorage()) {
    return Response.json({ error: "Synchronisation non configurée" }, { status: 503 });
  }
  if (!validTelegramWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token") ?? "")) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }
  let body;
  try { body = (await limitedRequestBody(request, 128_000)).toString("utf8"); } catch (error) { return requestBodyErrorResponse(error); }
  let update;
  try { update = JSON.parse(body); }
  catch { return Response.json({ error: "JSON invalide" }, { status: 400 }); }
  if (!update || !Number.isSafeInteger(update.update_id)) return new Response(null, { status: 400 });
  if (update.chat_join_request) {
    if (!premiumChannelAccessEnabled()) return Response.json({ ok: true, ignored: true });
    const join = update.chat_join_request;
    if (String(join.chat?.id) !== process.env.TELEGRAM_PREMIUM_CHANNEL_ID || join.chat?.type !== "channel" ||
        !Number.isSafeInteger(join.from?.id) || join.from.id <= 0 || join.from.is_bot || typeof join.invite_link?.invite_link !== "string") {
      return Response.json({ ok: true, ignored: true });
    }
    try {
      await withChannelAccess(String(join.from.id), service => service.join(String(join.from.id), join.invite_link.invite_link));
      return Response.json({ ok: true });
    } catch { return Response.json({ error: "Admission différée, réessayer" }, { status: 503 }); }
  }
  if (update.message || update.callback_query) {
    try {
      const copier = telegramCopyService();
      const copy = await copier.command(update);
      if (copy) {
        if (copy.wake) after(() => copier.worker().catch(() => {}));
        return Response.json(copy.reply);
      }
      const reply = await premiumTelegramReply(update);
      return Response.json(reply ?? { ok: true, ignored: true });
    } catch { return Response.json({ error: "Connexion non enregistrée, réessayer" }, { status: 503 }); }
  }
  const post = update.edited_channel_post ?? update.channel_post;
  if (!post) return Response.json({ ok: true, ignored: true });
  if (post.chat?.type !== "channel" || String(post.chat?.id) !== channel) {
    // The same bot also administers the private Premium channel. A genuine
    // Telegram update outside the public catalogue is acknowledged, not retried.
    // The webhook secret has already been checked above; no content is saved.
    return Response.json({ ok: true, ignored: true });
  }
  if (!Number.isSafeInteger(post.message_id) || post.message_id <= 0) return new Response(null, { status: 400 });
  if (!Number.isSafeInteger(post.edit_date ?? post.date)) return new Response(null, { status: 400 });
  const text = post.text ?? post.caption ?? post.document?.file_name ?? post.video?.file_name ?? "";
  if (typeof text !== "string") return new Response(null, { status: 400 });
  try {
    const fileName = post.document?.file_name ?? post.video?.file_name;
    const entities = post.entities ?? post.caption_entities ?? [];
    if (fileName !== undefined && typeof fileName !== "string") return new Response(null, { status: 400 });
    const links = Array.isArray(entities) ? entities.filter((e) => e?.type === "text_link" && typeof e.url === "string").map((e) => e.url) : [];
    const parsed = await resolvePublication({ text, fileName, links, channelId: channel, messageId: post.message_id });
    const changed = await saveChannelPost(channel, {
      messageId: post.message_id,
      version: post.edit_date ?? post.date,
      updateId: update.update_id,
      text,
      ...(fileName ? { fileName } : {}),
      resolutionVersion: RESOLUTION_VERSION,
      titles: parsed.titles,
      pending: parsed.pending,
      review: parsed.review,
    });
    // Invalider aussi sur les retries : une interruption après écriture ne doit pas laisser le cache périmé.
    revalidateTag("catalogue", { expire: 0 });
    return Response.json({ ok: true, changed });
  } catch {
    // Pas de contenu Telegram ni de secret dans les logs/réponses.
    return Response.json({ error: "Échec de sauvegarde, réessayer" }, { status: 503 });
  }
}

/** Diagnostic authentifié, sans divulgation des messages ou des secrets. */
export async function GET(request: Request) {
  if (!hasTelegramWebhookSecret() || !hasCatalogueStorage()) return Response.json({ ok: false }, { status: 503 });
  if (!validTelegramWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token") ?? "")) return new Response(null, { status: 401 });
  try {
    const state = await readChannelState();
    const posts = Object.values(state.posts);
    return Response.json({ ok: true, posts: posts.length,
      resolvedPosts: posts.filter((p) => p.titles.length > 0).length,
      pendingPosts: posts.filter((p) => p.pending.length > 0).length,
      legacyPosts: posts.filter((p) => (p.resolutionVersion ?? 0) < RESOLUTION_VERSION).length,
      uniqueTitles: new Set(posts.flatMap((p) => p.titles.map((t) => `${t.kind}:${t.id}`))).size,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ ok: false }, { status: 503 }); }
}
