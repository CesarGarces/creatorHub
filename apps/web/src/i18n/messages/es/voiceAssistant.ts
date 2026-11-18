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
    "Su voz es Deepgram Aura-2, elegida según el idioma en que hablas: Andromeda (inglés), Celeste (español), Bianca (portugués).",
  voiceSettings: "Voz",
  pricing: "Voz {stt} cr/min · Respuesta 1 cr (hablada: 1 cr/min)",
  pricingShort: "{stt} cr/min de voz · 1 cr/respuesta",
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
