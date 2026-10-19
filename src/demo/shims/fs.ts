// node:fs/promises and node:path in the demo worker: nothing is written to disk there.
export const mkdir = async () => undefined;
export const writeFile = async () => undefined;
export const join = (...parts: string[]) => parts.join("/");
export const relative = (_from: string, to: string) => to;
export default { mkdir, writeFile, join, relative };
