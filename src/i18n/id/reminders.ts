import type { Messages } from "../catalogs";

const reminders: Messages["reminders"] = {
  heading: "Pengingat",
  add: "Tambah",
  needsDateHint: "Beri tanggal pada tugas agar bisa diingatkan sebelumnya — atau pilih waktu pasti di bawah.",
  remindAt: "Ingatkan pada",
  set: "Atur",
  none: "Tidak ada pengingat.",
  chooseWhere: "Pilih ke mana pengingat dikirim",
  atSetTime: "Pada waktu tertentu",
  sent: "Terkirim",
  passed: "Terlewat",
  failed: "Gagal terkirim",
  needsDate: "Perlu tanggal",
  remove: (label) => `Hapus pengingat: ${label}`,
};
export default reminders;
