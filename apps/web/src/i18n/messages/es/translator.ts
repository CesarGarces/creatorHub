import type { Messages } from "../../translate";

export const translator: Messages["translator"] = {
  translateTo: "Traducir a: {language}",
  selectLanguage: "Selecciona un idioma",
  targetLanguage: "Idioma de destino",
  translate: "Traducir",
  translating: "Traduciendo...",
  translatingContent: "Traduciendo contenido...",
  sourceText: "Texto original",
  speakNow: "Habla ahora...",
  inputPlaceholder: "Pega o escribe el texto que quieres traducir...",
  translation: "Traducción",
  outputPlaceholder: "La traducción aparecerá aquí",
  failedTitle: "La traducción falló",
  failed: "No se pudo traducir. Inténtalo de nuevo.",
  noJobId: "La traducción falló: no se recibió el ID del trabajo",
  copied: "Traducción copiada al portapapeles",
  newDictation: {
    title: "Nuevo dictado",
    description:
      "Hay un dictado existente que se reemplazará. ¿Quieres empezar uno nuevo?",
    confirm: "Sí, empezar uno nuevo",
    cancel: "No, mantener el actual",
  },
};
