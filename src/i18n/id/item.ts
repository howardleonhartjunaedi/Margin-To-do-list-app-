import type { Messages } from "../catalogs";

const item: Messages["item"] = {
  complete: "Selesaikan",
  markNotDone: "Tandai belum selesai",
  drag: "Seret",
  reschedule: "Jadwalkan ulang",
  rescheduleMenu: "Jadwalkan ulang…",
  moreActions: "Tindakan lain",
  open: "Buka",
  priority: "Prioritas",
  priorityNames: ["Mendesak", "Tinggi", "Normal", "Kapan-kapan"],
  current: "saat ini",
  delete: "Hapus",
  repeats: "Berulang",
  subtasksDone: "subtugas selesai",
  hasNotes: "Ada catatan",
  comments: "komentar",
  assignedTo: (name) => `Ditugaskan ke ${name}`,
};
export default item;
