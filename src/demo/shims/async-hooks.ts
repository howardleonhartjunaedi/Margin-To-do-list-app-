// AsyncLocalStorage in the demo worker. Only used to tag change notices with the sending tab,
// and the demo has no live updates, so a plain holder is enough.
export class AsyncLocalStorage<T> {
  private store: T | undefined;
  run<R>(store: T, fn: () => R): R {
    this.store = store;
    return fn();
  }
  getStore() {
    return this.store;
  }
}
