import { Logger } from "@creator-hub/shared-utils";
import { getRegisteredTools } from "./register-tool";
import { ToolDefinition } from "./tool-definition";

const logger = new Logger("LoadTools");

export function loadTools() {
  const toolInputs = getRegisteredTools();
  logger.info(`Loading ${toolInputs.length} tools...`);

  const manifests = toolInputs.map((input) => ToolDefinition.create(input));
  const backendModules = toolInputs
    .filter((t) => t.backend?.module)
    .map((t) => ({
      module: t.backend.module,
      toolId: t.id,
    }));

  return { manifests, backendModules };
}
