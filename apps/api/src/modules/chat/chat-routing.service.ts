import { Injectable } from "@nestjs/common";
import { ToolRegistry } from "@creator-hub/tool-sdk";
import { Logger } from "@creator-hub/shared-utils";
import type { ToolManifest } from "@creator-hub/shared-types";

@Injectable()
export class ChatRoutingService {
  private logger = new Logger("ChatRoutingService");

  constructor(private toolRegistry: ToolRegistry) {}

  buildSystemPrompt(): string {
    const tools = this.toolRegistry.getActive();
    const toolDescriptions = tools.map((tool) =>
      this.formatToolDescription(tool),
    );

    return `Eres el asistente de Creator Hub, una plataforma para creadores de contenido.

HERRAMIENTAS DISPONIBLES (usa cuando sea apropiado):
${toolDescriptions.length > 0 ? toolDescriptions.join("\n\n") : "No hay herramientas disponibles actualmente."}

REGLAS:
1. Cuando el usuario pida algo que coincida con una herramienta, responde con un JSON de acción:
   { "action": "route_to_tool", "toolId": "<id>", "params": { ... } }
2. Para preguntas generales, responde de forma concisa y útil en markdown.
3. Sé amable, profesional y directo.
4. Si no estás seguro de qué herramienta usar, pregunta al usuario.
5. Puedes combinar información de múltiples herramientas si es necesario.`;
  }

  private formatToolDescription(tool: ToolManifest): string {
    const categoryMap: Record<string, string> = {
      thumbnail: "Crear miniaturas/imágenes",
      video: "Crear videos",
      translator: "Traducir contenido",
      title: "Generar títulos",
      stream: "Herramientas de streaming",
      social: "Redes sociales",
      analytics: "Análisis",
      design: "Diseño",
      writing: "Escritura",
      other: "Otros",
    };

    const triggerWords = this.inferTriggerWords(tool);

    return `**${tool.name}** (${tool.category})
   Descripción: ${tool.description}
   Costo: ${tool.creditsPerUse} créditos
   Activa cuando: ${triggerWords}
   Ruta: ${tool.frontend.routes[0]?.path || "N/A"}`;
  }

  getActiveTools() {
    return this.toolRegistry.getActive();
  }

  private inferTriggerWords(tool: ToolManifest): string {
    const triggers: string[] = [];

    switch (tool.category) {
      case "thumbnail":
        triggers.push(
          "crear miniatura",
          "generar imagen",
          "thumbnail",
          "imagen para video",
        );
        break;
      case "video":
        triggers.push("crear video", "generar video", "video", "animación");
        break;
      case "translator":
        triggers.push("traducir", "traducción", "translate", "localizar");
        break;
      case "title":
        triggers.push("generar título", "título", "nombre para video", "title");
        break;
      case "stream":
        triggers.push("stream", "transmitir", "overlay");
        break;
      case "social":
        triggers.push("publicar", "redes sociales", "social");
        break;
      case "analytics":
        triggers.push("analizar", "estadísticas", "métricas");
        break;
      default:
        triggers.push(tool.name.toLowerCase());
    }

    return triggers.join(", ");
  }

  detectToolFromMessage(
    content: string,
  ): { toolId: string; confidence: number } | null {
    const tools = this.toolRegistry.getActive();
    const lowerContent = content.toLowerCase();

    let bestMatch: { toolId: string; confidence: number } | null = null;
    let bestConfidence = 0;

    for (const tool of tools) {
      const confidence = this.calculateMatchConfidence(tool, lowerContent);
      if (confidence > bestConfidence && confidence > 0.5) {
        bestConfidence = confidence;
        bestMatch = { toolId: tool.id, confidence };
      }
    }

    return bestMatch;
  }

  private calculateMatchConfidence(
    tool: ToolManifest,
    content: string,
  ): number {
    let confidence = 0;

    const nameWords = tool.name.toLowerCase().split(/\s+/);
    for (const word of nameWords) {
      if (word.length > 2 && content.includes(word)) {
        confidence += 0.3;
      }
    }

    const categoryKeywords: Record<string, string[]> = {
      thumbnail: ["miniatura", "thumbnail", "imagen", "foto", "diseñar"],
      video: ["video", "animación", "clipe", "grabar"],
      translator: ["traducir", "traducción", "translate", "idioma"],
      title: ["título", "title", "nombre", "encabezado"],
      stream: ["stream", "transmitir", "live", "overlay"],
      social: ["publicar", "post", "redes", "social"],
      analytics: ["analizar", "estadísticas", "métricas", "datos"],
    };

    const keywords = categoryKeywords[tool.category] || [];
    for (const keyword of keywords) {
      if (content.includes(keyword)) {
        confidence += 0.4;
      }
    }

    return Math.min(confidence, 1);
  }
}
