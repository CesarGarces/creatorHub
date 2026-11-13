import type { Messages } from "../../translate";

export const tools: Messages["tools"] = {
  title: "Herramientas",
  subtitle: "Herramientas con IA para creadores de contenido",
  filters: {
    all: "Todas",
    aiImage: "Imagen IA",
    aiText: "Texto IA",
    aiVideo: "Video IA",
    social: "Social",
    analytics: "Analítica",
  },
  emptyTitle: "No hay herramientas en esta categoría",
  emptyDescription: "Vuelve pronto para ver nuevas herramientas.",
  comingSoon: "Próximamente",
  upcoming: {
    repurposer: {
      name: "Reutilizador de contenido",
      description: "Convierte una pieza de contenido en 10 formatos",
    },
    seo: {
      name: "Optimizador SEO",
      description: "Optimiza tu contenido para los motores de búsqueda",
    },
    audio: {
      name: "Generador de audio",
      description: "Genera música y efectos de sonido",
    },
  },
};
