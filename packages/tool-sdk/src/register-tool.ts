import type { ToolManifestInput } from "./tool-definition";
import { ToolDefinition } from "./tool-definition";

const _registeredTools: ToolManifestInput[] = [];

export function registerTool(input: ToolManifestInput): ToolManifestInput {
  _registeredTools.push(input);
  return input;
}

export function getRegisteredTools(): ToolManifestInput[] {
  return _registeredTools;
}

export function getToolManifests() {
  return _registeredTools.map((t) => ToolDefinition.create(t));
}
