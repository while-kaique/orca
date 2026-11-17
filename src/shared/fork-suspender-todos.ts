// Fork (o-051): the main process asks the window to suspend every Claude chat before a close by X.
/** Window function the screen exposes; the main process calls it through executeJavaScript. */
export const FORK_SUSPEND_ALL_WINDOW_KEY = '__forkSuspenderTodos'

/** Same budget as the quit teardown deadline: past it the user would think the app hung; the sweep takes what is left. */
export const FORK_SUSPEND_ALL_DEADLINE_MS = 20_000
