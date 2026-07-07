import type { ToolManifestInput } from "./tool-definition";

const _registeredTools: ToolManifestInput[] = [];

export function registerTool(input: ToolManifestInput): ToolManifestInput {
  _registeredTools.push(input);
  return input;
}

export function getRegisteredTools(): ToolManifestInput[] {
  return _registeredTools;
}
