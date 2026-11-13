import type { Messages } from "../../translate";

export const video: Messages["video"] = {
  promptPlaceholder: "Descreva o vídeo que você quer criar...",
  sourceImage: "Imagem de origem",
  sourceImageAlt: "Imagem de origem",
  imageLoaded: "Imagem carregada",
  dropHere: "Solte a imagem aqui",
  dragOrClick: "Arraste e solte ou clique",
  fileHint: "PNG, JPG, WEBP de até 10 MB",
  selectImageFile: "Selecione um arquivo de imagem",
  imageTooLarge: "A imagem deve ter menos de 10 MB",
  sourceImageRequired: "Envie uma imagem de origem para Imagem para Vídeo",
  videoModel: "Modelo de vídeo",
  advancedSettings: "Configurações avançadas",
  duration: "Duração",
  audio: "Áudio",
  quality: "Qualidade",
  qualityGroup: "Seleção de qualidade",
  qualityOption: "Qualidade {quality}",
  costBreakdown: "({cost}/seg × {duration}s)",
  generate: "Gerar vídeo",
  insufficientCreditsNeed:
    "Créditos insuficientes. São necessários {count} créditos.",
  failed: "Não foi possível gerar o vídeo. Tente novamente.",
  emptyTitle: "Crie seu vídeo",
  emptyDescription:
    "Digite um prompt e clique em gerar para criar vídeos incríveis com IA.",
  generatingLabel: "Gerando vídeo... Isso pode levar alguns minutos.",
};
