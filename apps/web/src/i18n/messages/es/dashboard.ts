import type { Messages } from "../../translate";

export const dashboard: Messages["dashboard"] = {
  greeting: {
    morning: "Buenos días, {name} 👋",
    afternoon: "Buenas tardes, {name} 👋",
    evening: "Buenas noches, {name} 👋",
  },
  subtitle: "¿Qué vas a crear hoy?",
  search: "Buscar...",
  quickPrompt: {
    placeholder: "Describe lo que quieres crear...",
    ariaLabel: "Describe lo que quieres crear",
    generate: "Generar",
    making: "Creando...",
    try: "Prueba:",
    examples: {
      gamingThumbnail: "Miniatura gaming",
      youtubeIntro: "Guion de intro para YouTube",
      viralTitle: "Título de video viral",
    },
  },
  favoriteTools: "Herramientas favoritas — arrastra para reordenar",
  quickAccess: "Acceso rápido",
  dragToReorder: "Arrastra para reordenar {name}",
  noToolsTitle: "No hay herramientas disponibles",
  noToolsDescription: "Las herramientas aparecerán aquí cuando se activen.",
  recentActivity: "Actividad reciente",
  noActivity: "Aún no hay actividad",
  activityMeta_one: "{time} · {count} crédito",
  activityMeta_other: "{time} · {count} créditos",
  txType: {
    tool: "Herramienta",
    purchase: "Compra",
    bonus: "Bonificación",
  },
  recommendedAgents: "Agentes recomendados",
  proTip: {
    title: "Consejo pro",
    body: 'Usa prompts negativos para excluir elementos no deseados de tus imágenes generadas. Por ejemplo: "sin texto, sin marca de agua, sin desenfoque" para obtener resultados más limpios.',
  },
};
