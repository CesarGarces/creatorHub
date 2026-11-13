import type { Messages } from "../../translate";

export const jobs: Messages["jobs"] = {
  translationReady: "Tradução pronta!",
  videoReady: "Vídeo pronto!",
  generationReady: "Geração pronta!",
  translationFailed: "A tradução falhou",
  videoFailed: "A geração do vídeo falhou",
  generationFailed: "A geração falhou",
  translationTimeout: "A tradução demorou demais. Tente novamente.",
  videoTimeout: "A geração do vídeo demorou demais. Tente novamente.",
  generationTimeout: "A geração demorou demais. Tente novamente.",
  translationTimeoutDetail:
    "A tradução demorou demais. O provedor de IA pode estar indisponível.",
  videoTimeoutDetail:
    "A geração do vídeo demorou demais. O provedor de IA pode estar indisponível.",
  generationTimeoutDetail:
    "A geração demorou demais. O provedor de IA pode estar indisponível.",
  sessionExpiredRedirect: "Sua sessão expirou. Redirecionando para o login...",
};
