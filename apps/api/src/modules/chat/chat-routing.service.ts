import { Injectable } from "@nestjs/common";
import { ToolRegistry } from "@creator-hub/tool-sdk";
import { Logger } from "@creator-hub/shared-utils";
import type { ToolManifest } from "@creator-hub/shared-types";

@Injectable()
export class ChatRoutingService {
  private logger = new Logger("ChatRoutingService");

  constructor(private toolRegistry: ToolRegistry) {}

  buildSystemPrompt(userMessage?: string): string {
    const tools = this.toolRegistry.getActive();
    const toolDescriptions = tools.map((tool) =>
      this.formatToolDescription(tool),
    );

    const detectedLanguage = this.detectLanguage(userMessage || "");
    const languageInstruction =
      detectedLanguage === "es"
        ? "Responde en español."
        : detectedLanguage === "pt"
          ? "Responda em português."
          : "Respond in English.";

    return `You are the Creator Hub assistant, a platform for content creators.

AVAILABLE TOOLS (use when appropriate):
${toolDescriptions.length > 0 ? toolDescriptions.join("\n\n") : "No tools available right now."}

RULES:
1. When the user requests something that matches a tool, respond with a JSON action inside a markdown code block:
   \`\`\`json
   { "action": "route_to_tool", "toolId": "<id>", "params": { ... } }
   \`\`\`
   Briefly explain what you'll do and show the action button.
2. For general questions, respond concisely and helpfully in markdown.
3. Be friendly, professional, and direct.
4. If you're unsure which tool to use, ask the user.
5. You can combine information from multiple tools if needed.
6. ${languageInstruction}`;
  }

  private formatToolDescription(tool: ToolManifest): string {
    const categoryMap: Record<string, string> = {
      thumbnail: "Create thumbnails/images",
      video: "Create videos",
      translator: "Translate content",
      title: "Generate titles",
      stream: "Streaming tools",
      social: "Social media",
      analytics: "Analytics",
      design: "Design",
      writing: "Writing",
      other: "Other",
    };

    const triggerWords = this.inferTriggerWords(tool);

    return `**${tool.name}** (${tool.category})
   Description: ${tool.description}
   Cost: ${tool.creditsPerUse} credits
   Activates when: ${triggerWords}
   Route: ${tool.frontend.routes[0]?.path || "N/A"}`;
  }

  getActiveTools() {
    return this.toolRegistry.getActive();
  }

  private detectLanguage(text: string): string {
    const sample = text.toLowerCase().slice(0, 200);

    const spanishWords = [
      "hola",
      "que",
      "como",
      "para",
      "por",
      "una",
      "los",
      "las",
      "del",
      "está",
      "necesito",
      "quiero",
      "puedo",
      "tengo",
      "hacer",
      "crear",
      "generar",
      "video",
      "imagen",
      "miniatura",
      "traducir",
      "título",
      "gracias",
      "por favor",
      "ayuda",
      "buenos",
      "días",
      "noches",
    ];
    const portugueseWords = [
      "olá",
      "como",
      "para",
      "por",
      "uma",
      "os",
      "as",
      "do",
      "da",
      "está",
      "preciso",
      "quero",
      "posso",
      "tenho",
      "fazer",
      "criar",
      "gerar",
      "vídeo",
      "imagem",
      "miniatura",
      "traduzir",
      "título",
      "obrigado",
      "por favor",
      "ajuda",
      "bom",
      "dia",
      "noite",
    ];

    let spanishScore = 0;
    let portugueseScore = 0;

    for (const word of spanishWords) {
      if (sample.includes(word)) spanishScore++;
    }
    for (const word of portugueseWords) {
      if (sample.includes(word)) portugueseScore++;
    }

    if (spanishScore > portugueseScore && spanishScore >= 2) return "es";
    if (portugueseScore > spanishScore && portugueseScore >= 2) return "pt";
    return "en";
  }

  private inferTriggerWords(tool: ToolManifest): string {
    const triggers: string[] = [];

    switch (tool.category) {
      case "thumbnail":
        triggers.push(
          "create thumbnail",
          "generate image",
          "thumbnail",
          "video thumbnail",
          "crear miniatura",
          "generar imagen",
          "imagen para video",
        );
        break;
      case "video":
        triggers.push(
          "create video",
          "generate video",
          "video",
          "animation",
          "crear video",
          "generar video",
          "animación",
        );
        break;
      case "translator":
        triggers.push(
          "translate",
          "translation",
          "localize",
          "traducir",
          "traducción",
          "localizar",
        );
        break;
      case "title":
        triggers.push(
          "generate title",
          "title",
          "video title",
          "generar título",
          "título",
          "nombre para video",
        );
        break;
      case "stream":
        triggers.push("stream", "broadcast", "overlay", "transmitir", "live");
        break;
      case "social":
        triggers.push(
          "publish",
          "social media",
          "social",
          "publicar",
          "redes sociales",
        );
        break;
      case "analytics":
        triggers.push(
          "analyze",
          "statistics",
          "metrics",
          "analizar",
          "estadísticas",
          "métricas",
        );
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
      thumbnail: [
        "thumbnail",
        "image",
        "photo",
        "design",
        "miniatura",
        "imagen",
        "foto",
        "diseñar",
      ],
      video: [
        "video",
        "animation",
        "clip",
        "record",
        "animación",
        "clipe",
        "grabar",
      ],
      translator: [
        "translate",
        "translation",
        "language",
        "traducir",
        "traducción",
        "idioma",
      ],
      title: ["title", "name", "heading", "título", "nombre", "encabezado"],
      stream: ["stream", "broadcast", "live", "overlay", "transmitir"],
      social: ["publish", "post", "social", "publicar", "redes"],
      analytics: [
        "analyze",
        "statistics",
        "metrics",
        "data",
        "analizar",
        "estadísticas",
        "métricas",
        "datos",
      ],
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
