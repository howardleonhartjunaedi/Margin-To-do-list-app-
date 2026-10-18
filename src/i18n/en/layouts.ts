export default {
  // Board
  groupBy: "Group by",
  groupBoardBy: "Group board by",
  priority: "Priority",
  project: "Project",
  board: "Board",
  boardDragHelp: "To move a task, press Space. Use the arrow keys to move it between columns, Space to drop, or Escape to cancel.",
  addTaskTo: (column: string) => `Add task to ${column}`,
  dropHere: "Drop a task here",
  // Matrix
  quadrants: {
    do: { title: "Do now", hint: "Important and due soon" },
    schedule: { title: "Schedule", hint: "Important, not pressing" },
    delegate: { title: "Batch or hand off", hint: "Pressing, not important" },
    drop: { title: "Let go", hint: "Neither — maybe later, maybe never" },
  },
  dueSoon: "Due soon",
  notPressing: "Not pressing",
  important: "Important",
  lessImportant: "Less important",
  // Calendar
  today: "Today",
  prevMonth: "Previous month",
  nextMonth: "Next month",
  nothingOnDay: "Nothing on this day.",
  dayCell: (date: string, n: number) => `${date}, ${n} ${n === 1 ? "task" : "tasks"}`,
  addTaskOn: (date: string) => `Add task on ${date}`,
  // Timeline
  earlier: "Two weeks earlier",
  later: "Two weeks later",
  nothingDated: "Nothing dated in these five weeks.",
  nothingDatedBody: "Give tasks a due date — and a start date for longer work — to see them here.",
  noDueHint: "Tasks without a due date don’t appear on the timeline.",
  due: (date: string) => `Due ${date}.`,
  span: (from: string, to: string) => `${from} → ${to}.`,
  bar: (title: string, range: string) => `${title}: ${range}. Arrow keys move, Shift+arrows change the due date.`,
  range: (from: string, to: string) => `${from} to ${to}`,
};
