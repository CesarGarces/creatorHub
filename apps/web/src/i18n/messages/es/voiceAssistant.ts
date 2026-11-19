import type { Messages } from "../../translate";

export const voiceAssistant: Messages["voiceAssistant"] = {
  title: "Robotina",
  titleLong: "Robotina — asistente de voz con IA",
  emptyDescription:
    "Habla de lo que quieras, en voz alta. Háblale en español, inglés o portugués y Robotina te responde con su voz, en tu idioma.",
  tapToTalk: "Toca la esfera para hablar",
  status: {
    idle: "Toca para hablar",
    listening: "Escuchando…",
    thinking: "Pensando…",
    speaking: "Hablando…",
  },
  orb: {
    talk: "Hablar con Robotina",
    finish: "Terminé de hablar — enviar",
    interrupt: "Interrumpir a Robotina y hablar",
  },
  stop: "Terminar conversación",
  handsFree: "Modo conversación",
  handsFreeHint: "Cuando responde, Robotina vuelve a escucharte",
  voiceNote:
    "Su voz es Deepgram, elegida según el idioma en que hablas — una voz por idioma:",
  voiceSettings: "Voz",
  pricing: "Voz {stt} cr/s · Respuesta 1 cr (hablada: {tts} cr/s)",
  pricingShort: "{stt} cr/s de voz · {tts} cr/s respuesta hablada",
  openChat: "Abrir chat",
  hideHistory: "Ocultar historial",
  showHistory: "Mostrar historial",
  newChat: "Nueva conversación",
  history: "Conversaciones",
  noConversations: "Aún no hay conversaciones",
  untitled: "Sin título",
  deleteConversation: "Eliminar conversación",
  modelSettings: "Configuración del modelo",
  inputPlaceholder: "Escribe un mensaje o toca el micrófono…",
  send: "Enviar",
  you: "Tú",
  replay: "Reproducir de nuevo",
  spoken: "Hablado",
  interrupted: "Interrumpida",
  voiceFailed: "Voz no disponible — respondió por texto",
  voiceOutOfCredits:
    "No hay créditos suficientes para su voz — el resto va en texto",
  voiceOutOfFreeMinutes:
    "Se acabaron tus minutos gratis — el resto va en texto",
  freeTier: {
    remainingMonthly_one:
      "Plan Free: te queda {count} de {total} minutos con Robotina este mes",
    remainingMonthly_other:
      "Plan Free: te quedan {count} de {total} minutos con Robotina este mes",
    remainingTotal_one:
      "Plan Free: te queda {count} de {total} minutos con Robotina",
    remainingTotal_other:
      "Plan Free: te quedan {count} de {total} minutos con Robotina",
    exhaustedTitle: "Usaste tus {total} minutos gratis con Robotina",
    exhaustedTitleNoTotal: "Usaste tus minutos gratis con Robotina",
    exhaustedMonthly:
      "Vuelven el {date}. Mejora tu plan para hablar con ella sin límites.",
    exhaustedLifetime:
      "Mejora tu plan para seguir hablando con ella sin límites.",
    upgrade: "Mejorar plan para uso ilimitado",
    limitError:
      "Usaste todos tus minutos gratis con Robotina. Mejora tu plan para uso ilimitado.",
  },
  credits: "{count} cr",
  loading: "Cargando conversación…",
  suggestions: {
    day: "¡Hola Robotina! ¿Qué tal tu día?",
    idea: "Ayúdame a pensar una idea para mi próximo video",
    explain: "Explícame los agujeros negros con palabras simples",
    practice: "Can we practice English for a while?",
  },
  languages: {
    en: "Inglés",
    es: "Español",
    pt: "Portugués",
  },
  actions: {
    running: {
      create: "Agregándolo a tu calendario…",
      list: "Revisando tu calendario…",
      update: "Actualizando tu calendario…",
      delete: "Preparando la eliminación…",
      other: "Trabajando en ello…",
    },
    created: "Agregado a tu calendario",
    updated: "Actualizado en tu calendario",
    moved: "Antes: {time}",
    deleted: "Eliminado de tu calendario",
    confirm: "Esperando tu confirmación para eliminar",
    confirmHint: "Di “sí” para confirmar",
    projectCreated: "Proyecto de video creado",
    projectUpdated: "Proyecto de video actualizado",
    projectDeleted: "Proyecto de video eliminado",
    projectSessions: "{done}/{total} sesiones hechas",
    projectWithSessions: "Con sus {count} sesiones",
    noPublishDate: "Sin fecha de publicación",
    publishOn: "Se publica {date}",
    projects: "Tus proyectos de video",
    noProjects: "Aún no hay proyectos de video",
    agenda: "Tu calendario",
    agendaEmpty: "Nada planificado",
    overlaps: "Se cruza con {title}",
    openPlanner: "Abrir en el planificador",
    more: "+{count} más",
    failed: "No se pudo completar",
  },
  widget: {
    hint: "Toca la esfera y di lo que quieras: te responde en voz alta.",
  },
  errors: {
    replyFailed: "Robotina no pudo responder. Inténtalo de nuevo.",
    modelFailed:
      "Robotina no pudo responder. Inténtalo de nuevo o elige otro modelo.",
    voiceUnsupported: "La entrada de voz no está disponible en este navegador.",
  },
};
