import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { route } from "@/server/http";
import { acceptInvite } from "@/server/sharing";

type Ctx = { params: Promise<{ token: string }> };

export const POST = route<Ctx>(async (_req, userId, { params }) => {
  const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
  return acceptInvite(userId, u.email, (await params).token);
});
