export default {
  reminder: "Reminder",
  overdueWas: (when: string) => `Overdue — was due ${when}`,
  due: (when: string) => `Due ${when}`,
  digestTitle: (today: number, overdue: number) => `Today: ${today} ${today === 1 ? "task" : "tasks"}${overdue ? `, ${overdue} overdue` : ""}`,
  overdueSuffix: " (overdue)",
  andMore: (n: number) => `…and ${n} more`,
  open: "Open in Margin",
  footer: "You get these because email reminders are on. Turn them off in Settings.",
  inviteTitle: (inviter: string, project: string) => `${inviter} invited you to “${project}”`,
  inviteBody: (project: string, role: string, days: number) =>
    `You’ve been invited to join the project “${project}” on Margin as ${/^[aeiou]/i.test(role) ? "an" : "a"} ${role.toLowerCase()}.\nThe link works for ${days} days.`,
  inviteFooter: "You got this because someone invited you to a project on Margin. Ignore it if it’s not for you.",
  someone: "Someone",
  pushTestTitle: "Reminders are on",
  pushTestBody: "This is what a reminder looks like on this device.",
};
