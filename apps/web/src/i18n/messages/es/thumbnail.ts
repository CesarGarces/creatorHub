import type { Messages } from "../../translate";

export const thumbnail: Messages["thumbnail"] = {
  styles: {
    bold: "Audaz y colorido",
    minimal: "Minimalista",
    gaming: "Gaming",
    cinematic: "Cinemático",
    tutorial: "Tutorial",
    reaction: "Cara de reacción",
  },
  negativePrompt: "Prompt negativo",
  promptPlaceholder: "Describe la miniatura que quieres crear...",
  negativePlaceholder: "Excluir: texto, marca de agua, desenfoque...",
  generate: "Generar miniatura",
  failed: "No se pudo generar la miniatura. Inténtalo de nuevo.",
  emptyTitle: "Crea tu miniatura",
  emptyDescription:
    "Escribe un prompt y haz clic en generar para crear miniaturas impactantes con IA.",
  generatingLabel: "Generando miniatura...",
};
