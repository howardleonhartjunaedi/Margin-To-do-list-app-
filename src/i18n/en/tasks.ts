export default {
  doneNext: (when: string) => `Done. Next: ${when}.`,
  completed: (title: string) => `Completed “${title}”.`,
  deleted: (title: string) => `Deleted “${title}”.`,
  movedTo: (label: string) => `Moved to ${label}.`,
  removedDate: "Removed the date.",
  snoozed: (label: string) => `Snoozed — ${label}.`,
};
