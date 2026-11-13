import type { Messages } from "../../translate";

export const thumbnail: Messages["thumbnail"] = {
  styles: {
    bold: "Ousado e colorido",
    minimal: "Minimalista",
    gaming: "Games",
    cinematic: "Cinemático",
    tutorial: "Tutorial",
    reaction: "Cara de reação",
  },
  negativePrompt: "Prompt negativo",
  promptPlaceholder: "Descreva a thumbnail que você quer criar...",
  negativePlaceholder: "Excluir: texto, marca d'água, desfoque...",
  generate: "Gerar thumbnail",
  failed: "Não foi possível gerar a thumbnail. Tente novamente.",
  emptyTitle: "Crie sua thumbnail",
  emptyDescription:
    "Digite um prompt e clique em gerar para criar thumbnails incríveis com IA.",
  generatingLabel: "Gerando thumbnail...",
};
