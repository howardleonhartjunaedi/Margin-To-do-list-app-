import type { Messages } from "../catalogs";

const common: Messages["common"] = {
  loadingTasks: "Memuat tugas",
  tryAgain: "Coba lagi",
  offline: "Anda sedang offline. Perubahan disimpan di sini dan akan disinkronkan saat Anda tersambung lagi.",
  unreachable: "Margin belum bisa dihubungi. Perubahan Anda disimpan di sini dan akan disinkronkan begitu tersambung.",
  waiting: (n) => `${n} menunggu`,
  savedOffline: "Anda sedang offline. Perubahan ini disimpan di perangkat ini dan akan disinkronkan saat Anda kembali online.",
  synced: (n) => `Kembali online. ${n} perubahan disinkronkan.`,
  syncFailed: (n) => `${n} perubahan tidak bisa disimpan — tugasnya mungkin sudah dihapus atau akses berbaginya dicabut.`,
  importedFromFrontPage: (n) => (n === 1 ? "Tugas yang Anda tulis di halaman depan sudah ditambahkan." : `${n} tugas yang Anda tulis di halaman depan sudah ditambahkan.`),
  somethingWrong: "Terjadi kesalahan. Perubahan Anda tidak tersimpan.",
  cancel: "Batal",
  save: "Simpan",
  done: "Selesai",
  delete: "Hapus",
  undo: "Urungkan",
  close: "Tutup",
  more: "Lainnya",
  edit: "Ubah",
  rename: "Ganti nama",
  dismiss: "Tutup",
  showMore: (n, rest) => `Tampilkan ${n} lagi dari ${rest}`,
  offlineNotSaved: "Anda sedang offline. Perubahan Anda tidak tersimpan — coba lagi saat Anda kembali online.",
  sessionEnded: "Sesi Anda berakhir. Masuk lagi untuk melanjutkan.",
};
export default common;
