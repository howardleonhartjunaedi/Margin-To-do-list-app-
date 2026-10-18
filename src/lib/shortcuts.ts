import { m } from "@/i18n/catalogs";

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
  const { keys: t, nav, layout } = m();
  return [
    {
      title: t.groups.anywhere,
      items: [
        { keys: ["Q"], label: t.addTask },
        { keys: [mod, "K"], label: t.palette },
        { keys: ["/"], label: t.search },
        { keys: ["?"], label: t.showShortcuts },
      ],
    },
    {
      title: t.groups.goTo,
      items: [
        { keys: ["G", "I"], sequence: true, label: nav.inbox },
        { keys: ["G", "T"], sequence: true, label: nav.today },
        { keys: ["G", "U"], sequence: true, label: nav.upcoming },
        { keys: ["G", "C"], sequence: true, label: t.calendar },
        { keys: ["G", "F"], sequence: true, label: t.focusTimer },
        { keys: ["G", "H"], sequence: true, label: nav.habits },
        { keys: ["G", "S"], sequence: true, label: nav.settings },
      ],
    },
    {
      title: t.groups.layout,
      items: [
        { keys: ["V", "L"], sequence: true, label: layout.names.list },
        { keys: ["V", "B"], sequence: true, label: layout.names.board },
        { keys: ["V", "C"], sequence: true, label: layout.names.calendar },
        { keys: ["V", "T"], sequence: true, label: layout.names.timeline },
        { keys: ["V", "M"], sequence: true, label: layout.names.matrix },
      ],
    },
    {
      title: t.groups.focused,
      items: [
        { keys: ["↑", "↓"], label: t.moveBetween },
        { keys: ["X"], label: t.complete },
        { keys: ["↵"], label: t.openDetails },
        { keys: ["T"], label: t.reschedule },
        { keys: ["1", "4"], label: t.setPriority },
        { keys: ["⌫"], label: t.deleteUndo },
        { keys: ["Alt", "↑"], label: t.moveUp },
      ],
    },
    {
      title: t.groups.cards,
      items: [
        { keys: ["Space"], label: t.pickUp },
        { keys: ["←", "→"], label: t.moveCard },
        { keys: ["Esc"], label: t.putBack },
      ],
    },
  ];
}

/** Quick-add syntax, shown alongside the shortcuts (examples in the language on screen). */
export const quickAddSyntax = () => m().keys.syntax;
