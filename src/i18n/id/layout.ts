import type { Messages } from "../catalogs";

const layout: Messages["layout"] = {
  layout: "Tata letak",
  names: { list: "Daftar", board: "Papan", calendar: "Kalender", timeline: "Linimasa", matrix: "Matriks" },
  shortcut: (name, key) => `${name} (V lalu ${key})`,
};
export default layout;
