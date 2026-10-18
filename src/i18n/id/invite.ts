import type { Messages } from "../catalogs";

const invite: Messages["invite"] = {
  title: "Undangan",
  missing: "Undangan ini tidak ada.",
  missingBody: "Tautannya mungkin salah ketik, atau sudah dicabut. Minta tautan baru kepada yang membagikannya.",
  expired: "Undangan ini sudah kedaluwarsa.",
  used: "Undangan ini sudah dipakai.",
  askFor: (inviter, project) => `Minta tautan baru ke “${project}” kepada ${inviter}.`,
  openIfIn: "Buka proyeknya, bila Anda sudah bergabung",
  invitedYou: (inviter, project) => [`${inviter} mengundang Anda ke `, project, "."],
  joinAs: (role) => `Anda akan bergabung sebagai ${role.toLowerCase()}.`,
  forEmail: (email) => ` Undangan ini untuk ${email}.`,
  alreadyMember: "Anda sudah menjadi anggota, jadi tautan ini tetap belum terpakai untuk orang yang dituju.",
  open: "Buka proyek",
  signInToAccept: "Masuk untuk menerima",
  createAccount: "Buat akun",
};
export default invite;
