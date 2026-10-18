import { createAuthClient } from "better-auth/react";
import { clearOutbox } from "./outbox";
import { clearOfflineData } from "./sw";

export const authClient = createAuthClient();
export const { signIn, signUp, useSession } = authClient;

/** Signs out and forgets everything this device kept for the account (cached pages, queued changes). */
export async function signOut() {
  const res = await authClient.signOut();
  clearOutbox();
  await clearOfflineData();
  return res;
}
