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
  widgets: {
    region: "Widgets do painel",
    quickPrompt: {
      name: "Prompt rápido",
      description: "Peça ao assistente para criar algo direto do seu painel.",
    },
    todayPlans: {
      name: "Planos para hoje",
      description:
        "As sessões de hoje do seu Planejador de conteúdo, com nome e descrição.",
    },
    favorites: {
      name: "Ferramentas favoritas",
      description:
        "Suas ferramentas marcadas na sua ordem, ou acesso rápido às primeiras.",
    },
    activity: {
      name: "Atividade recente",
      description:
        "Suas últimas movimentações de créditos: ferramentas, compras e bônus.",
    },
    recommendations: {
      name: "Recomendações",
      description:
        "Agentes escolhidos para ajudar você a crescer nas redes sociais.",
    },
    assetStats: {
      name: "Curtidas e visualizações",
      description:
        "Seus recursos mais curtidos com uma prévia, e o total de curtidas e visualizações.",
    },
    credits: {
      name: "Créditos",
      description:
        "Seu saldo e seu plano num relance, com um atalho para recarregar.",
    },
    tips: {
      name: "Dica pro",
      description:
        "Uma dica nova a cada hora para usar o Creator Hub e fazer seu canal crescer.",
    },
  },
  todayPlans: {
    open: "Abrir planejador",
    empty: "Nada planejado para hoje.",
    plan: "Planejar uma sessão",
    error: "Não foi possível carregar os planos de hoje.",
    retry: "Tentar novamente",
    more_one: "+{count} sessão",
    more_other: "+{count} sessões",
    now: "Agora",
    time: "{start} – {end}",
    from: "Desde {time}",
    until: "Até {time}",
    startsIn: "em {duration}",
    ago: "há {duration}",
    justEnded: "Acabou de terminar",
    minutes: "{minutes} min",
    hours: "{hours} h",
    hoursMinutes: "{hours} h {minutes} min",
  },
  assetStats: {
    open: "Ver recursos",
    totalLikes: "Curtidas no total",
    totalViews: "Visualizações no total",
    likes_one: "{count} curtida",
    likes_other: "{count} curtidas",
    views_one: "{count} visualização",
    views_other: "{count} visualizações",
    video: "Vídeo",
    newTab: "(abre em uma nova aba)",
    noPreview: "Sem prévia",
    untitled: "Sem título",
    empty:
      "Ainda não há curtidas nem visualizações. Compartilhe um recurso para começar a recebê-las.",
    goToAssets: "Ir para meus recursos",
    error: "Não foi possível carregar suas curtidas e visualizações.",
    retry: "Tentar novamente",
  },
  tips: {
    position: "Dica {index} de {total}",
    everyHour: "Uma dica nova a cada hora.",
    error: "Não foi possível carregar as dicas.",
    retry: "Tentar novamente",
    categories: {
      dashboard: "Painel",
      calendar: "Calendário",
      "ai-planner": "Planejamento com IA",
      viral: "Vídeos virais",
      thumbnails: "Thumbnails",
      scripts: "Roteiros",
      assistant: "Assistente de IA",
      clipper: "Cortes de vídeo",
      social: "Redes e comunidade",
      assets: "Recursos",
      credits: "Créditos",
      account: "Conta",
    },
  },
  creditsWidget: {
    available_one: "crédito disponível",
    available_other: "créditos disponíveis",
    plan: "Plano: {plan}",
    low: "Está acabando — recarregue para continuar criando.",
    buy: "Comprar créditos",
  },
  layout: {
    customize: "Personalizar",
    customizeLabel: "Personalizar painel",
    done: "Concluir",
    addWidgets: "Adicionar widgets",
    editing:
      "Arraste os widgets para reorganizá-los. Toque em − para ocultar um.",
    hide: "Ocultar {name}",
    move: "Mover {name}",
    hidden: "{name} oculto",
    undo: "Desfazer",
    saveFailed:
      "Não foi possível salvar seu painel. Sua última alteração foi desfeita.",
    emptyTitle: "Seu painel está vazio",
    emptyDescription:
      "Adicione widgets para trazer de volta suas ferramentas, atividade e recomendações.",
    dnd: {
      instructions:
        "Para pegar um widget, pressione Espaço ou Enter. Use as setas para movê-lo e depois Espaço ou Enter para soltá-lo, ou Escape para cancelar.",
      picked: "Você pegou {name}.",
      over: "{name} está agora na posição {position} de {total}.",
      dropped: "{name} solto na posição {position} de {total}.",
      cancelled: "Movimento cancelado. {name} voltou ao seu lugar.",
    },
  },
};
