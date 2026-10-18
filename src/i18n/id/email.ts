import type { Messages } from "../catalogs";

const email: Messages["email"] = {
  reminder: "Pengingat",
  overdueWas: (when) => `Terlambat — tenggatnya ${when}`,
  due: (when) => `Tenggat ${when}`,
  digestTitle: (today, overdue) => `Hari ini: ${today} tugas${overdue ? `, ${overdue} terlambat` : ""}`,
  overdueSuffix: " (terlambat)",
  andMore: (n) => `…dan ${n} lagi`,
  open: "Buka di Margin",
  footer: "Anda menerima ini karena pengingat email aktif. Matikan di Pengaturan.",
  inviteTitle: (inviter, project) => `${inviter} mengundang Anda ke “${project}”`,
  inviteBody: (project, role, days) => `Anda diundang bergabung ke proyek “${project}” di Margin sebagai ${role.toLowerCase()}.\nTautannya berlaku ${days} hari.`,
  inviteFooter: "Anda menerima ini karena seseorang mengundang Anda ke proyek di Margin. Abaikan bila bukan untuk Anda.",
  someone: "Seseorang",
  pushTestTitle: "Pengingat aktif",
  pushTestBody: "Seperti inilah pengingat tampil di perangkat ini.",
};
export default email;
