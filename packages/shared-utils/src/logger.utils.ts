export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log("INFO", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log("WARN", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log("ERROR", message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log("DEBUG", message, meta);
  }

  private log(
    level: string,
    message: string,
    meta?: Record<string, unknown>
  ): void {
    const timestamp = new Date().toISOString();
    const base = { timestamp, level, context: this.context, message };
    const output = meta ? { ...base, ...meta } : base;
    console[level === "ERROR" ? "error" : "log"](JSON.stringify(output));
  }
}
