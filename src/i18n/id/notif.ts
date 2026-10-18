import type { Messages } from "../catalogs";

const notif: Messages["notif"] = {
  title: "Notifikasi",
  unread: (n) => `Notifikasi, ${n} belum dibaca`,
  empty: "Belum ada apa-apa.",
  emptyBody: "Pengingat yang Anda pasang pada tugas muncul di sini, dan di perangkat Anda bila push diaktifkan.",
  done: "Selesai",
  snooze: "Tunda",
  open: "Buka",
  snoozeChoices: [
    { label: "10 menit", short: "10 menit lagi" },
    { label: "1 jam", short: "1 jam lagi" },
    { label: "3 jam", short: "3 jam lagi" },
    { label: "Besok 09.00", short: "sampai besok 09.00" },
  ],
};
export default notif;
