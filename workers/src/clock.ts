/// The time the sources go by. A module-level hook so tests can move it:
/// fake timers and workerd's I/O do not mix.
export const clock = {now: (): number => Date.now()}
