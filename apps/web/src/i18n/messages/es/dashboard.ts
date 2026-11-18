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
  widgets: {
    region: "Widgets del panel",
    quickPrompt: {
      name: "Prompt rápido",
      description:
        "Pídele al asistente que cree algo directamente desde tu panel.",
    },
    todayPlans: {
      name: "Planes para hoy",
      description:
        "Las sesiones de hoy de tu Planificador de contenido, con su nombre y descripción.",
    },
    favorites: {
      name: "Herramientas favoritas",
      description:
        "Tus herramientas marcadas en tu orden, o acceso rápido a las primeras.",
    },
    activity: {
      name: "Actividad reciente",
      description:
        "Tus últimos movimientos de créditos: herramientas, compras y bonificaciones.",
    },
    recommendations: {
      name: "Recomendaciones",
      description: "Agentes elegidos para ayudarte a crecer en redes sociales.",
    },
    assetStats: {
      name: "Me gusta y visualizaciones",
      description:
        "Tus recursos con más me gusta, con una vista previa, y el total de me gusta y visualizaciones.",
    },
    credits: {
      name: "Créditos",
      description:
        "Tu saldo y tu plan de un vistazo, con un atajo para recargar.",
    },
    tips: {
      name: "Consejo pro",
      description:
        "Un consejo nuevo cada hora para usar Creator Hub y hacer crecer tu canal.",
    },
    voiceAssistant: {
      name: "Robotina",
      description:
        "Toca la esfera y habla con tu asistente de voz con IA, en español, inglés o portugués.",
    },
  },
  todayPlans: {
    open: "Abrir planificador",
    empty: "No tienes nada planificado para hoy.",
    plan: "Planificar una sesión",
    error: "No se pudieron cargar los planes de hoy.",
    retry: "Reintentar",
    more_one: "+{count} sesión más",
    more_other: "+{count} sesiones más",
    now: "Ahora",
    time: "{start} – {end}",
    from: "Desde {time}",
    until: "Hasta {time}",
    startsIn: "en {duration}",
    ago: "hace {duration}",
    justEnded: "Acaba de terminar",
    minutes: "{minutes} min",
    hours: "{hours} h",
    hoursMinutes: "{hours} h {minutes} min",
  },
  assetStats: {
    open: "Ver recursos",
    totalLikes: "Me gusta en total",
    totalViews: "Visualizaciones en total",
    likes_one: "{count} me gusta",
    likes_other: "{count} me gusta",
    views_one: "{count} visualización",
    views_other: "{count} visualizaciones",
    video: "Video",
    newTab: "(se abre en una pestaña nueva)",
    noPreview: "Sin vista previa",
    untitled: "Sin título",
    empty:
      "Aún no hay me gusta ni visualizaciones. Comparte un recurso para empezar a recibirlos.",
    goToAssets: "Ir a mis recursos",
    error: "No se pudieron cargar tus me gusta y visualizaciones.",
    retry: "Reintentar",
  },
  tips: {
    position: "Consejo {index} de {total}",
    everyHour: "Un consejo nuevo cada hora.",
    error: "No se pudieron cargar los consejos.",
    retry: "Reintentar",
    categories: {
      dashboard: "Panel",
      calendar: "Calendario",
      "ai-planner": "Planificación con IA",
      viral: "Videos virales",
      thumbnails: "Miniaturas",
      scripts: "Guiones",
      assistant: "Asistente de IA",
      clipper: "Recortes de video",
      social: "Redes y comunidad",
      assets: "Recursos",
      credits: "Créditos",
      account: "Cuenta",
    },
  },
  creditsWidget: {
    available_one: "crédito disponible",
    available_other: "créditos disponibles",
    plan: "Plan: {plan}",
    low: "Te quedan pocos: recarga para seguir creando.",
    buy: "Comprar créditos",
  },
  layout: {
    customize: "Personalizar",
    customizeLabel: "Personalizar panel",
    done: "Listo",
    addWidgets: "Añadir widgets",
    editing: "Arrastra los widgets para reordenarlos. Toca − para ocultar uno.",
    hide: "Ocultar {name}",
    move: "Mover {name}",
    hidden: "{name} oculto",
    undo: "Deshacer",
    saveFailed: "No se pudo guardar tu panel. Se deshizo tu último cambio.",
    emptyTitle: "Tu panel está vacío",
    emptyDescription:
      "Añade widgets para recuperar tus herramientas, actividad y recomendaciones.",
    dnd: {
      instructions:
        "Para tomar un widget, pulsa Espacio o Intro. Usa las flechas para moverlo y luego Espacio o Intro para soltarlo, o Escape para cancelar.",
      picked: "Tomaste {name}.",
      over: "{name} está ahora en la posición {position} de {total}.",
      dropped: "{name} soltado en la posición {position} de {total}.",
      cancelled: "Movimiento cancelado. {name} volvió a su lugar.",
    },
  },
};
