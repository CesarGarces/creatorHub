import type { Messages } from "../../translate";

export const providerSelect: Messages["providerSelect"] = {
  defaultLabel: "Modelo de IA",
  loading: "Cargando modelos...",
  empty: "No hay modelos disponibles para esta herramienta.",
  selectModel: "Selecciona un modelo",
  pro: "PRO",
  upgrade: "(mejora tu plan)",
  creditsShort: "{count} cr",
  taskTypes: {
    "image-generation": "Imagen",
    "text-generation": "Texto",
    "video-generation": "Video",
  },
};
