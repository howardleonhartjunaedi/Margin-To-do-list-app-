import type { Messages } from "../catalogs";

const UNIT = { day: "hari", week: "minggu", month: "bulan", year: "tahun", time: "kali" } as const;

const time: Messages["time"] = {
  atTaskTime: "Tepat saat waktu tugas",
  offset: (n, unit, before) => `${n} ${{ minute: "menit", hour: "jam", day: "hari" }[unit]} ${before ? "sebelumnya" : "sesudahnya"}`,
  every: (unit, n) => (n === 1 ? (unit === "time" ? "Berulang" : `Setiap ${UNIT[unit]}`) : `Setiap ${n} ${UNIT[unit]}`),
  everyWeekday: "Setiap hari kerja",
  everyOn: (days) => `Setiap ${days}`,
  everyMonthOn: (day) => `Setiap bulan tanggal ${day}`,
  duration: (h, m) => (h ? (m ? `${h} j ${m} mnt` : `${h} j`) : `${m} mnt`),
};
export default time;
