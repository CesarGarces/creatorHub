import type { Messages } from "../../translate";

export const agents: Messages["agents"] = {
  title: "Agentes",
  subtitle: "Asistentes de IA que te ayudan a crear contenido",
  yourAgents: "Tus agentes",
  comingSoon: "Próximamente",
  redirecting: "Redirigiendo a la herramienta...",
  badges: {
    social: "Social",
    research: "Investigación",
    voice: "Voz",
  },
  items: {
    xPost: {
      name: "Agente de publicación en X",
      description:
        "Publica tweets e hilos en tu cuenta de X (Twitter) conectada",
      shortDescription: "Publica tweets e hilos en tu cuenta de X",
    },
    xResearch: {
      name: "Agente de investigación en X",
      description: "Busca y analiza temas en tendencia en X (Twitter)",
      shortDescription: "Busca y analiza temas en tendencia en X",
    },
    robotina: {
      name: "Robotina",
      description:
        "Tu asistente de voz con IA: habla de lo que quieras, en voz alta, en español, inglés o portugués",
      shortDescription: "Habla de lo que quieras, en voz alta",
    },
    youtube: {
      name: "Agente de YouTube",
      description: "Planifica, escribe y optimiza tus videos con IA",
    },
    instagram: {
      name: "Agente de Instagram",
      description: "Crea publicaciones e historias atractivas para Instagram",
    },
    twitch: {
      name: "Agente de Twitch",
      description:
        "Gestiona tu contenido en vivo y la interacción con tu audiencia",
    },
  },
};
