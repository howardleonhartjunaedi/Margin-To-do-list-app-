import type React from "react";

export default {
  title: "Invitation",
  missing: "This invitation doesn’t exist.",
  missingBody: "The link may be mistyped, or it was revoked. Ask whoever shared it for a new one.",
  expired: "This invitation has expired.",
  used: "This invitation was already used.",
  askFor: (inviter: string, project: string) => `Ask ${inviter} for a new link to “${project}”.`,
  openIfIn: "Open the project, if you’re already in it",
  invitedYou: (inviter: string, project: React.ReactNode) => [`${inviter} invited you to `, project, "."],
  joinAs: (role: string) => `You’ll join as ${/^[aeiou]/i.test(role) ? "an" : "a"} ${role.toLowerCase()}.`,
  forEmail: (email: string) => ` This invitation is for ${email}.`,
  alreadyMember: "You’re already a member, so this link is still unused for whoever it’s meant for.",
  open: "Open the project",
  signInToAccept: "Sign in to accept",
  createAccount: "Create an account",
};
