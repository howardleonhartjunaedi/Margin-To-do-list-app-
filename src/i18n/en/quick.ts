export default {
  dialogTitle: "Add a task",
  placeholder: "Call Sam tomorrow 4pm #work p2",
  inputLabel: "Task, with optional date, priority, #project and @labels",
  added: (title: string, where: string) => `Added “${title}” to ${where}.`,
  /** Syntax examples shown under the input, in this language's quick-add words. */
  try: "Try",
  examples: ["fri 9am", "every mon", "p1", "#project", "@label"],
  done: "Done",
  add: "Add",
  understood: "Understood",
  fromPage: "From the page you’re on",
  newProject: (name: string) => `New project “${name}”`,
  inlinePlaceholder: "What needs doing?",
  newTask: "New task",
  // Date choices (reschedule menus)
  today: "Today",
  tomorrow: "Tomorrow",
  weekend: "This weekend",
  nextWeek: "Next week",
  noDate: "No date",
  pickDate: "Pick a date",
};
