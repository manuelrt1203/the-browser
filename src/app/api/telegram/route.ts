import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { hasCatalogueStorage, readChannelState, saveChannelPost } from "@/lib/telegram-store";

import { RESOLUTION_VERSION, resolvePublication } from "@/lib/telegram-resolution";


export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const channel = process.env.TELEGRAM_CHANNEL_ID;
  if (!secret || !channel || !hasCatalogueStorage()) {
    return Response.json({ error: "Synchronisation non configurée" }, { status: 503 });
  }
  const supplied = Buffer.from(request.headers.get("x-telegram-bot-api-secret-token") ?? "");
  const expected = Buffer.from(secret);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }
  const body = await request.text();
  if (Buffer.byteLength(body) > 128_000) return new Response(null, { status: 413 });
  let update;
  try { update = JSON.parse(body); }
  catch { return Response.json({ error: "JSON invalide" }, { status: 400 }); }
  if (!update || !Number.isSafeInteger(update.update_id)) return new Response(null, { status: 400 });
  const post = update.edited_channel_post ?? update.channel_post;
  if (!post) return Response.json({ ok: true, ignored: true });
  if (post.chat?.type !== "channel" || String(post.chat?.id) !== channel) {
    return Response.json({ error: "Canal non autorisé" }, { status: 403 });
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
    const parsed = await resolvePublication({ text, fileName, links });
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
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || !hasCatalogueStorage()) return Response.json({ ok: false }, { status: 503 });
  const supplied = Buffer.from(request.headers.get("x-telegram-bot-api-secret-token") ?? "");
  const expected = Buffer.from(secret);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return new Response(null, { status: 401 });
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
