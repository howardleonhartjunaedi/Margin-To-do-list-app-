export default {
  title: "Notifications",
  unread: (n: number) => `Notifications, ${n} unread`,
  empty: "Nothing yet.",
  emptyBody: "Reminders you set on tasks show up here, and on your devices if you turn on push.",
  done: "Done",
  snooze: "Snooze",
  open: "Open",
  snoozeChoices: [
    { label: "10 minutes", short: "in 10 min" },
    { label: "1 hour", short: "in 1 hour" },
    { label: "3 hours", short: "in 3 hours" },
    { label: "Tomorrow 09:00", short: "until tomorrow 09:00" },
  ],
};
