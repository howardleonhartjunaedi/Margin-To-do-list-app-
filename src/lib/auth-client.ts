import { createAuthClient } from "better-auth/react";
import { clearOutbox } from "./outbox";
import { clearOfflineData } from "./sw";
import { DEMO_USER } from "@/demo/user";
import { DEMO, endDemo } from "./demo";

export const authClient = createAuthClient();
export const { signIn, signUp } = authClient;
/** In the browser demo there's no server session; the signed-in user is always the demo user. */
export const useSession: typeof authClient.useSession = DEMO
  ? ((() => ({ data: { user: DEMO_USER }, isPending: false, error: null })) as unknown as typeof authClient.useSession)
  : authClient.useSession;

/** Signs out and forgets everything this device kept for the account (cached pages, queued changes). */
export async function signOut() {
  if (DEMO) return endDemo();
  const res = await authClient.signOut();
  clearOutbox();
  await clearOfflineData();
  return res;
}
