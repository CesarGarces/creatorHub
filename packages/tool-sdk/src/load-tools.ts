import { Logger } from "@creator-hub/shared-utils";
import { getRegisteredTools } from "./register-tool";
import { ToolDefinition } from "./tool-definition";

const logger = new Logger("LoadTools");

export function loadTools() {
  const toolInputs = getRegisteredTools();
  logger.info(`Loading ${toolInputs.length} tools...`);

  const manifests = toolInputs.map((input) => ToolDefinition.create(input));
  const backendModules = toolInputs.reduce<
    { module: string; toolId: string }[]
  >((acc, t) => {
    if (t.backend?.module) {
      acc.push({ module: t.backend.module, toolId: t.id });
    }
    return acc;
  }, []);

  return { manifests, backendModules };
}
