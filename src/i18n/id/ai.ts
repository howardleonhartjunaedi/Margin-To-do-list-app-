import type { Messages } from "../catalogs";

const ai: Messages["ai"] = {
  failed: "Saran tidak bisa diambil. Coba lagi.",
  noSteps: "Tidak ada langkah yang bisa disarankan untuk tugas ini.",
  addedSteps: (n) => `${n} langkah ditambahkan.`,
  suggestSteps: "Sarankan langkah",
  working: "Menyusun langkah-langkah…",
  suggested: "Langkah yang disarankan — hapus centang yang tidak Anda perlukan.",
  keep: (title) => `Simpan: ${title}`,
  addSteps: (n) => `Tambah ${n} langkah`,
  dismiss: "Tutup",
  sortInbox: "Rapikan Kotak Masuk",
  sortLede: "Saran tempat untuk setiap tugas. Tidak ada yang berubah sampai Anda menerapkannya.",
  sorted: "Tidak ada saran — Kotak Masuk Anda sudah rapi.",
  apply: "Terapkan",
  skip: "Lewati",
  applyAll: (n) => `Terapkan semua (${n})`,
};
export default ai;
