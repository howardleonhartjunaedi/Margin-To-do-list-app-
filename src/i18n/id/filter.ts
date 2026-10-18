import type { Messages } from "../catalogs";

const filter: Messages["filter"] = {
  filter: "Filter",
  textPlaceholder: "Kata di judul atau catatan",
  byText: "Filter berdasarkan teks",
  priority: "Prioritas",
  date: "Tanggal",
  project: "Proyek",
  label: "Label",
  clearAll: "Hapus semua",
  due: { overdue: "Terlambat", today: "Hari ini", week: "7 hari ke depan", dated: "Bertanggal", none: "Tanpa tanggal" },
  deletedProject: "Proyek yang sudah dihapus",
  everythingOpen: "Semua yang terbuka",
  remove: (label) => `Hapus ${label}`,
  update: "Perbarui filter",
  save: "Simpan",
  namePlaceholder: "Beri nama filter ini",
  name: "Nama filter",
  reset: "Atur ulang",
  clear: "Hapus",
  nothingMatches: "Tidak ada yang cocok dengan filter ini.",
  hiddenBy: (n) => `${n} tugas tersembunyi olehnya.`,
  clearFilter: "Hapus filter",
  cantReach: (msg) => `${msg} Tugas Anda aman — kami hanya belum bisa menjangkaunya saat ini.`,
  updated: "Filter diperbarui.",
  saved: (name) => `“${name}” disimpan. Ada di bilah samping.`,
};
export default filter;
