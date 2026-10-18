import { eq } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import webpush from "web-push";
import type { Db } from "../db/types";
import { pushSubscription } from "../db/schema";
import type { Channels, OutboundMessage } from "./core";
import { publish } from "../events";
import { m } from "@/i18n/catalogs";
import { SERVERLESS } from "../site";

/*
 * Real delivery channels.
 *  Push:  Web Push with VAPID keys from env. Expired subscriptions (404/410) are removed.
 *  Email: SMTP_URL if set; otherwise each message is written to .data/outbox/*.eml so
 *         local development never sends real mail.
 */

let vapidReady: boolean | null = null;
function ensureVapid() {
  if (vapidReady !== null) return vapidReady;
  const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = process.env;
  vapidReady = !!(pub && priv);
  if (vapidReady) webpush.setVapidDetails(subject ?? "mailto:admin@localhost", pub!, priv!);
  else console.warn("[push] VAPID keys missing — push notifications are off");
  return vapidReady;
}

let transport: Transporter | null = null;
function mailer() {
  transport ??= process.env.SMTP_URL
    ? nodemailer.createTransport(process.env.SMTP_URL)
    : nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  return transport;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function emailHtml(msg: OutboundMessage) {
  const body = escapeHtml(msg.body).replace(/\n/g, "<br>");
  const words = m(msg.locale ?? "en").email;
  return `<!doctype html><html lang="${msg.locale ?? "en"}"><body style="margin:0;background:#f6f2ea;padding:32px 16px;font-family:Georgia,serif;color:#1d1b18">
<div style="max-width:480px;margin:0 auto">
<p style="font-size:13px;color:#6b6458;margin:0 0 16px">Margin</p>
<h1 style="font-size:24px;font-weight:normal;margin:0 0 8px">${escapeHtml(msg.title)}</h1>
<p style="font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#48433b;margin:0 0 24px">${body}</p>
<a href="${escapeHtml(msg.url)}" style="font-family:Arial,sans-serif;font-size:14px;color:#fff8f2;background:#467235;padding:10px 16px;border-radius:8px;text-decoration:none">${escapeHtml(words.open)}</a>
<p style="font-family:Arial,sans-serif;font-size:12px;color:#6b6458;margin:32px 0 0">${escapeHtml(msg.footer ?? words.footer)}</p>
</div></body></html>`;
}

export function realChannels(db: Db): Channels {
  return {
    inApp(userId) {
      return publish(db, [userId], { type: "notification" });
    },
    async push(msg) {
      if (!ensureVapid()) return;
      const subs = await db.select().from(pushSubscription).where(eq(pushSubscription.userId, msg.userId));
      const payload = JSON.stringify({
        title: msg.title,
        body: msg.body,
        url: msg.url,
        tag: msg.tag,
        reminderId: msg.reminderId,
        taskId: msg.taskId,
      });
      await Promise.all(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
              TTL: 60 * 60,
              urgency: "high",
            });
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) await db.delete(pushSubscription).where(eq(pushSubscription.id, s.id));
            else throw e;
          }
        }),
      );
    },

    async email(msg) {
      const info = await mailer().sendMail({
        from: process.env.EMAIL_FROM ?? "Margin <reminders@localhost>",
        to: msg.email,
        subject: msg.title,
        text: `${msg.title}\n\n${msg.body}\n\nOpen: ${msg.url}`,
        html: emailHtml(msg),
      });
      if (!process.env.SMTP_URL && SERVERLESS) {
        console.warn(`[email] SMTP_URL isn't set; "${msg.title}" was not sent`);
      } else if (!process.env.SMTP_URL && "message" in info) {
        const dir = path.join(/* turbopackIgnore: true */ process.cwd(), ".data", "outbox");
        await mkdir(dir, { recursive: true });
        const file = path.join(dir, `${Date.now()}-${msg.tag}.eml`);
        await writeFile(file, info.message as Buffer);
        console.log(`[email] (dev) wrote ${path.relative(process.cwd(), file)}`);
      }
    },
  };
}
