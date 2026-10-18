import type { Messages } from "../catalogs";

const quick: Messages["quick"] = {
  dialogTitle: "Tambah tugas",
  placeholder: "Telepon Sam besok jam 4 sore #kerja p2",
  inputLabel: "Tugas, dengan tanggal, prioritas, #proyek dan @label (opsional)",
  added: (title, where) => `“${title}” ditambahkan ke ${where}.`,
  try: "Coba",
  examples: ["jumat jam 9", "setiap senin", "p1", "#proyek", "@label"],
  done: "Selesai",
  add: "Tambah",
  understood: "Dipahami",
  fromPage: "Dari halaman yang sedang Anda buka",
  newProject: (name) => `Proyek baru “${name}”`,
  inlinePlaceholder: "Apa yang perlu dikerjakan?",
  newTask: "Tugas baru",
  today: "Hari ini",
  tomorrow: "Besok",
  weekend: "Akhir pekan ini",
  nextWeek: "Minggu depan",
  noDate: "Tanpa tanggal",
  pickDate: "Pilih tanggal",
};
export default quick;
