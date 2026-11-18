import { Injectable } from "@nestjs/common";
import type {
  AssistantActionArgs,
  AssistantActionContext,
  AssistantActionDefinition,
  AssistantActionParameter,
  AssistantActionResult,
} from "@creator-hub/shared-types";
import { Logger, isClockTime, isIsoDate } from "@creator-hub/shared-utils";

/** An action a tool lets the AI assistant perform for the user. */
export interface AssistantActionHandler extends AssistantActionDefinition {
  /**
   * Runs the action for `context.userId`. `args` are already validated
   * against `parameters`. Expected failures (a slot in the past, an invalid
   * combination) return `{ ok: false, summary }` for the assistant to explain;
   * thrown errors are reported the same way.
   */
  execute(
    args: AssistantActionArgs,
    context: AssistantActionContext,
  ): Promise<AssistantActionResult>;
}

export class ActionArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionArgsError";
  }
}

const ACTION_NAME = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

/**
 * Checks model-written arguments against an action's parameters: known
 * names only, required ones present, types (numbers given as strings are
 * accepted), formats (`date`, `time`), enums, lengths and ranges. Returns
 * the cleaned arguments (strings trimmed, empty optional values dropped).
 */
export function validateActionArgs(
  parameters: readonly AssistantActionParameter[],
  raw: unknown,
): AssistantActionArgs {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ActionArgsError("Arguments must be an object");
  }
  const input = raw as Record<string, unknown>;
  const known = new Set(parameters.map((p) => p.name));
  const unknown = Object.keys(input).filter((k) => !known.has(k));
  if (unknown.length > 0) {
    throw new ActionArgsError(`Unknown argument(s): ${unknown.join(", ")}`);
  }

  const args: AssistantActionArgs = {};
  for (const p of parameters) {
    let value = input[p.name];
    if (typeof value === "string") value = value.trim();
    if (value === undefined || value === null || value === "") {
      if (p.required) throw new ActionArgsError(`Missing ${p.name}`);
      continue;
    }

    switch (p.type) {
      case "integer": {
        const n = typeof value === "string" ? Number(value) : value;
        if (typeof n !== "number" || !Number.isInteger(n)) {
          throw new ActionArgsError(`${p.name} must be a whole number`);
        }
        if (p.min !== undefined && n < p.min) {
          throw new ActionArgsError(`${p.name} must be at least ${p.min}`);
        }
        if (p.max !== undefined && n > p.max) {
          throw new ActionArgsError(`${p.name} must be at most ${p.max}`);
        }
        value = n;
        break;
      }
      case "boolean":
        if (value === "true" || value === "false") value = value === "true";
        if (typeof value !== "boolean") {
          throw new ActionArgsError(`${p.name} must be true or false`);
        }
        break;
      case "date":
        if (!isIsoDate(value)) {
          throw new ActionArgsError(`${p.name} must be a date (YYYY-MM-DD)`);
        }
        break;
      case "time":
        if (!isClockTime(value)) {
          throw new ActionArgsError(`${p.name} must be a time (HH:mm)`);
        }
        break;
      case "string":
        if (typeof value !== "string") {
          throw new ActionArgsError(`${p.name} must be text`);
        }
        if (p.maxLength !== undefined && value.length > p.maxLength) {
          throw new ActionArgsError(
            `${p.name} is longer than ${p.maxLength} characters`,
          );
        }
        break;
    }
    if (p.enum && !p.enum.includes(value as string | number)) {
      throw new ActionArgsError(
        `${p.name} must be one of: ${p.enum.join(", ")}`,
      );
    }
    args[p.name] = value as string | number | boolean;
  }
  return args;
}

/**
 * Registry of the actions the AI assistant can perform (ARCHITECTURE.md
 * §14g "Actions"). Tools register their handlers at startup (a provider
 * with `OnModuleInit` in the tool's module); the assistant lists them in
 * its prompt and runs them through `execute()`. Global, provided by
 * ToolSdkModule like the ToolRegistry.
 */
@Injectable()
export class AssistantActionRegistry {
  private readonly actions = new Map<string, AssistantActionHandler>();
  private readonly logger = new Logger("AssistantActionRegistry");

  register(action: AssistantActionHandler): void {
    if (!ACTION_NAME.test(action.name)) {
      throw new Error(`Invalid assistant action name: ${action.name}`);
    }
    if (this.actions.has(action.name)) {
      this.logger.warn(`Assistant action overwritten: ${action.name}`);
    }
    this.actions.set(action.name, action);
    this.logger.info(`Assistant action registered: ${action.name}`);
  }

  unregister(name: string): void {
    this.actions.delete(name);
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  /** Definitions only (what the model is told), in registration order. */
  list(): AssistantActionDefinition[] {
    return [...this.actions.values()].map(
      ({ name, toolId, description, parameters, mutates, example }) => ({
        name,
        toolId,
        description,
        parameters,
        mutates,
        ...(example ? { example } : {}),
      }),
    );
  }

  /**
   * Validates and runs an action. Never throws: unknown actions, invalid
   * arguments and handler errors come back as `{ ok: false, summary }` so
   * the assistant can tell the user and ask again.
   */
  async execute(
    name: string,
    rawArgs: unknown,
    context: AssistantActionContext,
  ): Promise<AssistantActionResult & { args: AssistantActionArgs }> {
    const action = this.actions.get(name);
    if (!action) {
      return { ok: false, summary: `Unknown action "${name}"`, args: {} };
    }
    let args: AssistantActionArgs;
    try {
      args = validateActionArgs(action.parameters, rawArgs);
    } catch (error) {
      return {
        ok: false,
        summary: `Invalid arguments: ${(error as Error).message}`,
        args: {},
      };
    }
    try {
      const result = await action.execute(args, context);
      return { ...result, args };
    } catch (error) {
      this.logger.error("Assistant action failed", {
        action: name,
        userId: context.userId,
        error: (error as Error).message,
      });
      return {
        ok: false,
        summary: `The action failed: ${(error as Error).message}`,
        args,
      };
    }
  }
}
