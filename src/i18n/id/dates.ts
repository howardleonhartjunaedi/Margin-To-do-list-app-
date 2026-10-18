import type { Messages } from "../catalogs";

const dates: Messages["dates"] = {
  today: "Hari ini",
  tomorrow: "Besok",
  yesterday: "Kemarin",
  justNow: "baru saja",
  minAgo: (n) => `${n} mnt lalu`,
  hoursAgo: (n) => `${n} jam lalu`,
};
export default dates;
