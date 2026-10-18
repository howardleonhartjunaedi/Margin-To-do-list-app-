import type { Messages } from "../catalogs";

const tasks: Messages["tasks"] = {
  doneNext: (when) => `Selesai. Berikutnya: ${when}.`,
  completed: (title) => `“${title}” selesai.`,
  deleted: (title) => `“${title}” dihapus.`,
  movedTo: (label) => `Dipindah ke ${label}.`,
  removedDate: "Tanggal dihapus.",
  snoozed: (label) => `Ditunda — ${label}.`,
};
export default tasks;
