import type { Messages } from "../../translate";

export const voice: Messages["voice"] = {
  label: "Voz",
  listening: "Escuchando...",
  startRecording: "Iniciar dictado por voz",
  stopRecording: "Detener grabación",
  creditsPerMinute: "+{count} cr/min",
  errors: {
    notSupported: "El dictado por voz no es compatible con este navegador",
    connectionFailed: "No se pudo conectar con el servidor",
    permissionDenied: "Se denegó el permiso del micrófono",
    noMicrophone: "No se encontró ningún micrófono",
    micFailed: "No se pudo acceder al micrófono",
  },
};
