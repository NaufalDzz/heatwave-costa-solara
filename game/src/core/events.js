// A tiny publish/subscribe bus so systems can react to each other (gunfire scares pedestrians,
// a crime raises the wanted level, a wreck completes a mission stage) without importing each other.
export function createEvents() {
  const handlers = new Map();
  return {
    on(name, fn) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(fn);
    },
    emit(name, data) {
      for (const fn of handlers.get(name) || []) fn(data);
    },
  };
}
