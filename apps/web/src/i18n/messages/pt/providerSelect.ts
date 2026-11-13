import type { Messages } from "../../translate";

export const providerSelect: Messages["providerSelect"] = {
  defaultLabel: "Modelo de IA",
  loading: "Carregando modelos...",
  empty: "Nenhum modelo disponível para esta ferramenta.",
  selectModel: "Selecione um modelo",
  pro: "PRO",
  upgrade: "(faça upgrade)",
  creditsShort: "{count} cr",
  taskTypes: {
    "image-generation": "Imagem",
    "text-generation": "Texto",
    "video-generation": "Vídeo",
  },
};
