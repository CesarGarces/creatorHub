export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, data?: Record<string, unknown>) {
    console.log(`[${this.context}] ${message}`, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    console.warn(`[${this.context}] ${message}`, data);
  }

  error(message: string, data?: Record<string, unknown>) {
    console.error(`[${this.context}] ${message}`, data);
  }

  debug(message: string, data?: Record<string, unknown>) {
    console.debug(`[${this.context}] ${message}`, data);
  }
}

export function generateId(prefix?: string): string {
  const random = Math.random().toString(36).substring(2, 15);
  return prefix ? `${prefix}_${random}` : random;
}
