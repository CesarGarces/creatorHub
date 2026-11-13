import type { Messages } from "../../translate";

export const dashboard: Messages["dashboard"] = {
  greeting: {
    morning: "Bom dia, {name} 👋",
    afternoon: "Boa tarde, {name} 👋",
    evening: "Boa noite, {name} 👋",
  },
  subtitle: "O que você vai criar hoje?",
  search: "Pesquisar...",
  quickPrompt: {
    placeholder: "Descreva o que você quer criar...",
    ariaLabel: "Descreva o que você quer criar",
    generate: "Gerar",
    making: "Criando...",
    try: "Experimente:",
    examples: {
      gamingThumbnail: "Thumbnail de games",
      youtubeIntro: "Roteiro de introdução para YouTube",
      viralTitle: "Título de vídeo viral",
    },
  },
  favoriteTools: "Ferramentas favoritas — arraste para reordenar",
  quickAccess: "Acesso rápido",
  dragToReorder: "Arraste para reordenar {name}",
  noToolsTitle: "Nenhuma ferramenta disponível",
  noToolsDescription: "As ferramentas aparecerão aqui quando forem ativadas.",
  recentActivity: "Atividade recente",
  noActivity: "Nenhuma atividade ainda",
  activityMeta_one: "{time} · {count} crédito",
  activityMeta_other: "{time} · {count} créditos",
  txType: {
    tool: "Ferramenta",
    purchase: "Compra",
    bonus: "Bônus",
  },
  recommendedAgents: "Agentes recomendados",
  proTip: {
    title: "Dica pro",
    body: 'Use prompts negativos para excluir elementos indesejados das imagens geradas. Por exemplo: "sem texto, sem marca d\'água, sem desfoque" para resultados mais limpos.',
  },
};
