import { route } from "@/server/http";
import { disableFeed, feedStatus, rotateFeed } from "@/server/integrations";

export const GET = route(async (_req, userId) => feedStatus(userId), { sessionOnly: true });
/** Turn on, or replace the secret URL. */
export const POST = route(async (_req, userId) => rotateFeed(userId), { sessionOnly: true });
export const DELETE = route(async (_req, userId) => disableFeed(userId), { sessionOnly: true });
