type LogLevel = "debug" | "info" | "warn" | "error";
import { publicEnv } from "./public-env";

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getEnvLevel(): LogLevel {
  const env = (publicEnv.NEXT_PUBLIC_LOG_LEVEL || "").toLowerCase();
  if (env in LEVELS) return env as LogLevel;
  // Por defecto: info en desarrollo, warn en producción
  return process.env.NODE_ENV !== "production" ? "info" : "warn";
}

let currentLevel: LogLevel = getEnvLevel();

function isLevelEnabled(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

function setLevel(level: LogLevel) {
  currentLevel = level;
}

function debug(...args: unknown[]) {
  if (isLevelEnabled("debug")) {
    console.debug(...args);
  }
}

function info(...args: unknown[]) {
  if (isLevelEnabled("info")) {
    console.info(...args);
  }
}

function warn(...args: unknown[]) {
  if (isLevelEnabled("warn")) {
    console.warn(...args);
  }
}

function error(...args: unknown[]) {
  if (isLevelEnabled("error")) {
    // Solo consola: el detalle tecnico no se pinta al usuario. Quien necesite feedback
    // visible llama a showToast con una clave traducida.
    console.error(...args);
  }
}

export const logger = {
  debug,
  info,
  warn,
  error,
  isLevelEnabled,
  setLevel,
};
