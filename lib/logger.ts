/**
 * Tiny scoped logger used across the app so every action is traceable.
 *
 * - Server logs (crawler, routes, lib) print to the terminal running `npm run dev`.
 * - Client logs (UI actions) print to the browser devtools console.
 *
 * Each line is `HH:MM:SS.mmm [scope] message {…data}` with a side tag so it's
 * obvious where a log came from. Set CASCADE_SILENT=1 to mute server logs.
 */

const isServer = typeof window === "undefined";

function timestamp(): string {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

type Level = "info" | "warn" | "error";

function emit(level: Level, scope: string, message: string, data?: unknown) {
  if (isServer && process.env.CASCADE_SILENT === "1") return;
  const side = isServer ? "srv" : "ui ";
  const prefix = `${timestamp()} [${side}] [${scope}] ${message}`;
  const fn =
    level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (data !== undefined) fn(prefix, data);
  else fn(prefix);
}

export type Logger = {
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
  /** Time an async step and log its start + duration. */
  step: <T>(message: string, fn: () => Promise<T>) => Promise<T>;
};

export function createLogger(scope: string): Logger {
  return {
    info: (message, data) => emit("info", scope, message, data),
    warn: (message, data) => emit("warn", scope, message, data),
    error: (message, data) => emit("error", scope, message, data),
    step: async <T>(message: string, fn: () => Promise<T>): Promise<T> => {
      const start = Date.now();
      emit("info", scope, `▶ ${message}`);
      try {
        const result = await fn();
        emit("info", scope, `✔ ${message} (${Date.now() - start}ms)`);
        return result;
      } catch (err) {
        emit("error", scope, `✖ ${message} failed (${Date.now() - start}ms)`, err);
        throw err;
      }
    },
  };
}
