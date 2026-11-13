import type { Messages } from "../../translate";

export const commandPalette: Messages["commandPalette"] = {
  placeholder: "Pesquise ferramentas, agentes, páginas...",
  empty: "Nenhum resultado encontrado.",
  groups: {
    tools: "Ferramentas",
    agents: "Agentes",
    navigation: "Navegação",
    account: "Conta",
    other: "Outros",
  },
  items: {
    thumbnail: {
      label: "Gerador de thumbnails",
      description: "Crie thumbnails incríveis",
    },
    xPostAgent: {
      label: "Agente de publicação no X",
      description: "Publique tweets no X",
    },
    xResearchAgent: {
      label: "Agente de pesquisa no X",
      description: "Pesquise tendências no X",
    },
    dashboard: { label: "Painel", description: "Ir para o painel" },
    tools: {
      label: "Todas as ferramentas",
      description: "Explore todas as ferramentas",
    },
    agents: {
      label: "Todos os agentes",
      description: "Explore todos os agentes",
    },
    credits: { label: "Créditos", description: "Gerencie seus créditos" },
    history: {
      label: "Histórico",
      description: "Veja o histórico de gerações",
    },
    settings: {
      label: "Configurações",
      description: "Configurações do aplicativo",
    },
  },
};
