// Better Auth in the demo worker: everyone is the demo user.
import { DEMO_USER } from "../user";

const session = async () => ({
  user: { ...DEMO_USER, emailVerified: true, image: null, createdAt: new Date(), updatedAt: new Date() },
  session: { id: "demo-session", userId: DEMO_USER.id, token: "demo", expiresAt: new Date(Date.now() + 864e5), createdAt: new Date(), updatedAt: new Date() },
});

export const auth = { api: { getSession: session } };
export const getSession = session;
export async function requireUserId(): Promise<string> {
  return DEMO_USER.id;
}
