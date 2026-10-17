/** Every keyboard shortcut in the app, in one place: the help dialog renders this list. */

export const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const modKey = () => (isMac() ? "⌘" : "Ctrl");

export interface Shortcut {
  keys: string[]; // pressed together, or in sequence when `sequence`
  sequence?: boolean;
  label: string;
}

export function shortcutGroups(): { title: string; items: Shortcut[] }[] {
  const mod = modKey();
  return [
    {
      title: "Anywhere",
      items: [
        { keys: ["Q"], label: "Add a task" },
        { keys: [mod, "K"], label: "Command palette" },
        { keys: ["/"], label: "Search tasks" },
        { keys: ["?"], label: "Show these shortcuts" },
      ],
    },
    {
      title: "Go to",
      items: [
        { keys: ["G", "I"], sequence: true, label: "Inbox" },
        { keys: ["G", "T"], sequence: true, label: "Today" },
        { keys: ["G", "U"], sequence: true, label: "Upcoming" },
        { keys: ["G", "C"], sequence: true, label: "Calendar" },
        { keys: ["G", "F"], sequence: true, label: "Focus timer" },
        { keys: ["G", "H"], sequence: true, label: "Habits" },
        { keys: ["G", "S"], sequence: true, label: "Settings" },
      ],
    },
    {
      title: "Layout",
      items: [
        { keys: ["V", "L"], sequence: true, label: "List" },
        { keys: ["V", "B"], sequence: true, label: "Board" },
        { keys: ["V", "C"], sequence: true, label: "Calendar" },
        { keys: ["V", "T"], sequence: true, label: "Timeline" },
        { keys: ["V", "M"], sequence: true, label: "Matrix" },
      ],
    },
    {
      title: "Focused task in a list",
      items: [
        { keys: ["↑", "↓"], label: "Move between tasks (or J / K)" },
        { keys: ["X"], label: "Complete (or Space)" },
        { keys: ["↵"], label: "Open details (or E)" },
        { keys: ["T"], label: "Reschedule" },
        { keys: ["1", "4"], label: "Set priority 1–4" },
        { keys: ["⌫"], label: "Delete (with undo)" },
        { keys: ["Alt", "↑"], label: "Move up in Inbox or a project" },
      ],
    },
    {
      title: "Board, matrix, calendar",
      items: [
        { keys: ["Space"], label: "Pick up / drop a card" },
        { keys: ["←", "→"], label: "Move a picked-up card" },
        { keys: ["Esc"], label: "Put it back" },
      ],
    },
  ];
}

/** Quick-add syntax, shown alongside the shortcuts. */
export const QUICK_ADD_SYNTAX: [string, string][] = [
  ["tomorrow 5pm", "date and time"],
  ["fri", "the next Friday"],
  ["every mon", "repeats"],
  ["p1", "priority"],
  ["#home", "project"],
  ["@calls", "label"],
  ["~45m", "estimate"],
  ['"May"', "quotes keep words literal"],
];
