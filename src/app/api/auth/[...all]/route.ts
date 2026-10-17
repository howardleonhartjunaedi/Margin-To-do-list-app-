import { toNextJsHandler } from "better-auth/next-js";
import { dbReady } from "@/server/db";
import { auth } from "@/server/auth";

const handlers = toNextJsHandler(auth);

export async function GET(req: Request) {
  await dbReady();
  return handlers.GET(req);
}

export async function POST(req: Request) {
  await dbReady();
  return handlers.POST(req);
}
