import type { Messages } from "../../translate";

export const common: Messages["common"] = {
  appName: "Creator Hub",
  appDescription: "Ferramentas com IA para criadores de conteúdo",
  actions: {
    cancel: "Cancelar",
    saveChanges: "Salvar alterações",
    close: "Fechar",
    tryAgain: "Tentar novamente",
    copy: "Copiar",
    copyUrl: "Copiar URL",
    download: "Baixar",
    viewAll: "Ver tudo →",
    generating: "Gerando...",
    generateNew: "Gerar novo",
  },
  status: {
    loading: "Carregando...",
    pending: "Pendente",
    completed: "Concluído",
    unknownError: "Erro desconhecido",
  },
  time: {
    justNow: "Agora mesmo",
  },
  credits: {
    count_one: "{count} crédito",
    count_other: "{count} créditos",
    cost_one: "⚡ {count} crédito",
    cost_other: "⚡ {count} créditos",
  },
  toasts: {
    urlCopied: "URL copiada para a área de transferência",
    downloadStarted: "Download iniciado",
    downloadFailed: "Falha no download",
  },
  plans: {
    FREE: "PLANO GRÁTIS",
    PAY_AS_YOU_GO: "PAGUE CONFORME USAR",
    PREMIUM: "PREMIUM",
    STARTER: "STARTER",
    PRO: "PRO",
  },
  enterToSend: "Enter para enviar",
  shiftEnterNewLine: "Shift+Enter para nova linha",
};
