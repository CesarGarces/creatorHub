import type { Messages } from "../../translate";

export const translator: Messages["translator"] = {
  translateTo: "Traduzir para: {language}",
  selectLanguage: "Selecione um idioma",
  targetLanguage: "Idioma de destino",
  translate: "Traduzir",
  translating: "Traduzindo...",
  translatingContent: "Traduzindo conteúdo...",
  sourceText: "Texto original",
  speakNow: "Fale agora...",
  inputPlaceholder: "Cole ou digite o texto que você quer traduzir...",
  translation: "Tradução",
  outputPlaceholder: "A tradução aparecerá aqui",
  failedTitle: "A tradução falhou",
  failed: "Não foi possível traduzir. Tente novamente.",
  noJobId: "A tradução falhou: nenhum ID de tarefa retornado",
  copied: "Tradução copiada para a área de transferência",
  newDictation: {
    title: "Novo ditado",
    description:
      "Há um ditado existente que será substituído. Deseja começar um novo?",
    confirm: "Sim, começar novo",
    cancel: "Não, manter o atual",
  },
};
