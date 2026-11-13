import type { Messages } from "../../translate";

export const agents: Messages["agents"] = {
  title: "Agentes",
  subtitle: "Assistentes de IA que ajudam você a criar conteúdo",
  yourAgents: "Seus agentes",
  comingSoon: "Em breve",
  redirecting: "Redirecionando para a ferramenta...",
  badges: {
    social: "Social",
    research: "Pesquisa",
  },
  items: {
    xPost: {
      name: "Agente de publicação no X",
      description:
        "Publique tweets e threads na sua conta do X (Twitter) conectada",
      shortDescription: "Publique tweets e threads na sua conta do X",
    },
    xResearch: {
      name: "Agente de pesquisa no X",
      description: "Pesquise e analise assuntos em alta no X (Twitter)",
      shortDescription: "Pesquise e analise assuntos em alta no X",
    },
    youtube: {
      name: "Agente do YouTube",
      description: "Planeje, roteirize e otimize seus vídeos com IA",
    },
    instagram: {
      name: "Agente do Instagram",
      description: "Crie posts e stories envolventes para o Instagram",
    },
    twitch: {
      name: "Agente da Twitch",
      description: "Gerencie suas lives e o engajamento do seu público",
    },
  },
};
