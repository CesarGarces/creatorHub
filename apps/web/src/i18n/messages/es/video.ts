import type { Messages } from "../../translate";

export const video: Messages["video"] = {
  promptPlaceholder: "Describe el video que quieres crear...",
  sourceImage: "Imagen de origen",
  sourceImageAlt: "Imagen de origen",
  imageLoaded: "Imagen cargada",
  dropHere: "Suelta la imagen aquí",
  dragOrClick: "Arrastra y suelta o haz clic",
  fileHint: "PNG, JPG, WEBP de hasta 10 MB",
  selectImageFile: "Selecciona un archivo de imagen",
  imageTooLarge: "La imagen debe pesar menos de 10 MB",
  sourceImageRequired: "Sube una imagen de origen para Imagen a Video",
  videoModel: "Modelo de video",
  advancedSettings: "Configuración avanzada",
  duration: "Duración",
  audio: "Audio",
  quality: "Calidad",
  qualityGroup: "Selección de calidad",
  qualityOption: "Calidad {quality}",
  costBreakdown: "({cost}/seg × {duration}s)",
  generate: "Generar video",
  insufficientCreditsNeed:
    "Créditos insuficientes. Necesitas {count} créditos.",
  failed: "No se pudo generar el video. Inténtalo de nuevo.",
  emptyTitle: "Crea tu video",
  emptyDescription:
    "Escribe un prompt y haz clic en generar para crear videos impresionantes con IA.",
  generatingLabel: "Generando video... Esto puede tardar unos minutos.",
};
