export default {
  layout: "Layout",
  names: { list: "List", board: "Board", calendar: "Calendar", timeline: "Timeline", matrix: "Matrix" },
  shortcut: (name: string, key: string) => `${name} (V then ${key})`,
};
