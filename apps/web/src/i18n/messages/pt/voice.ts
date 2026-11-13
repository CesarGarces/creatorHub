import type { Messages } from "../../translate";

export const voice: Messages["voice"] = {
  label: "Voz",
  listening: "Ouvindo...",
  startRecording: "Iniciar ditado por voz",
  stopRecording: "Parar gravação",
  creditsPerMinute: "+{count} cr/min",
  errors: {
    notSupported: "O ditado por voz não é compatível com este navegador",
    connectionFailed: "Não foi possível conectar ao servidor",
    permissionDenied: "Permissão do microfone negada",
    noMicrophone: "Nenhum microfone encontrado",
    micFailed: "Não foi possível acessar o microfone",
  },
};
