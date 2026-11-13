import type { Messages } from "../../translate";

export const commandPalette: Messages["commandPalette"] = {
  placeholder: "Busca herramientas, agentes, páginas...",
  empty: "No se encontraron resultados.",
  groups: {
    tools: "Herramientas",
    agents: "Agentes",
    navigation: "Navegación",
    account: "Cuenta",
    other: "Otros",
  },
  items: {
    thumbnail: {
      label: "Generador de miniaturas",
      description: "Crea miniaturas impactantes",
    },
    xPostAgent: {
      label: "Agente de publicación en X",
      description: "Publica tweets en X",
    },
    xResearchAgent: {
      label: "Agente de investigación en X",
      description: "Busca tendencias en X",
    },
    dashboard: { label: "Panel", description: "Ir al panel" },
    tools: {
      label: "Todas las herramientas",
      description: "Explora todas las herramientas",
    },
    agents: {
      label: "Todos los agentes",
      description: "Explora todos los agentes",
    },
    credits: { label: "Créditos", description: "Gestiona tus créditos" },
    history: {
      label: "Historial",
      description: "Consulta el historial de generaciones",
    },
    settings: {
      label: "Configuración",
      description: "Configuración de la aplicación",
    },
  },
};
