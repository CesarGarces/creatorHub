import type { Messages } from "../translate";

export const es: Messages = {
  meta: {
    title: "Creator Hub — Un espacio de trabajo. Contenido infinito.",
    description:
      "Plataforma con IA para creadores de contenido. Genera miniaturas y videos, y traduce contenido con herramientas y agentes de IA.",
  },
  common: {
    logoAlt: "Creator Hub",
    approxCredits: "~{count} créditos",
    credits: "{count} créditos",
  },
  nav: {
    tools: "Herramientas",
    agents: "Agentes",
    pricing: "Precios",
    faq: "Preguntas frecuentes",
    login: "Iniciar sesión",
    signUp: "Registrarse",
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
  },
  hero: {
    titleStart: "Un espacio de trabajo.",
    titleHighlight: "Contenido infinito.",
    subtitle:
      "Crea miniaturas y videos, y traduce contenido a otros idiomas con herramientas y agentes de IA.",
    startFree: "Empieza a crear gratis",
    watchDemo: "Ver demo",
    closeVideo: "Cerrar video",
    videoUnsupported: "Tu navegador no admite la etiqueta de video.",
    mock: {
      dashboard: "Panel de Creator Hub",
      toolTitle: "Generador de miniaturas",
      toolDescription: "Miniaturas con IA para YouTube, Twitch y TikTok",
      agentTitle: "Agente de X (Twitter)",
      capabilities: {
        posts: "Generación de posts en X",
        analysis: "Análisis con IA",
        trends: "Investigación de tendencias",
      },
      thisWeek: "Esta semana",
      thumbnails: "Miniaturas",
      videos: "Videos",
      translations: "Traducciones",
    },
  },
  howItWorks: {
    eyebrow: "Cómo funciona",
    title: "De la idea al contenido en segundos",
    steps: {
      describe: {
        title: "Describe lo que necesitas",
        description: "Cuéntale a la IA lo que quieres crear con tus palabras.",
      },
      generate: {
        title: "La IA lo genera",
        description:
          "Nuestras herramientas y agentes de IA crean tu contenido en segundos.",
      },
      refine: {
        title: "Ajusta y perfecciona",
        description:
          "Retoca, vuelve a generar y personaliza hasta que quede perfecto.",
      },
      publish: {
        title: "Publica",
        description: "Descarga, publica o envía directamente a tu plataforma.",
      },
    },
  },
  tools: {
    eyebrow: "Herramientas de IA",
    title: "Herramientas reales para creadores reales",
    subtitle:
      "Cada herramienta está diseñada para resolver problemas concretos de creación de contenido, con modelos de IA de última generación.",
    explore: "Explorar",
    items: {
      thumbnail: {
        title: "Generador de miniaturas",
        description:
          "Genera miniaturas profesionales con IA. Admite varios estilos, prompts personalizados, prompts negativos y dimensiones ajustables. Perfecto para YouTube, Twitch y TikTok.",
      },
      video: {
        title: "Generador de videos",
        description:
          "Crea videos con IA usando los modelos de Wan AI. Admite texto a video e imagen a video, y varias relaciones de aspecto (16:9, 9:16, 1:1). Ideal para contenido corto y largo.",
      },
      translator: {
        title: "Traductor de contenido",
        description:
          "Traduce tu contenido a varios idiomas con la precisión de la IA. Amplía tu audiencia global con traducciones naturales y contextuales en segundos.",
      },
    },
  },
  agents: {
    eyebrow: "Agentes de IA",
    title: "Tu equipo de contenido con IA",
    subtitle:
      "Agentes de IA especializados que entienden tu plataforma y te ayudan a crecer. Cada agente está entrenado con las mejores prácticas de su plataforma.",
    status: {
      online: "En línea",
      comingSoon: "Próximamente",
    },
    samplePrompt: "Prompt de ejemplo",
    tryAgent: "Probar {agent}",
    items: {
      x: {
        title: "Agente de X (Twitter)",
        description:
          "Investiga tendencias y publica tweets. Análisis de tendencias con IA, análisis de sentimiento y publicación con un clic.",
        capabilities: {
          a: "Investigación de tendencias",
          b: "Análisis con IA",
          c: "Generación de tweets",
          d: "Análisis de sentimiento",
        },
        prompt:
          "Investiga los temas en tendencia sobre cripto y genera un tweet...",
      },
      youtube: {
        title: "Agente de YouTube",
        description:
          "Optimiza tus videos para YouTube. Obtén sugerencias de títulos, etiquetas SEO e ideas de miniaturas.",
        capabilities: {
          a: "Generación de títulos",
          b: "Etiquetas SEO",
          c: "Estrategia de contenido",
          d: "Análisis de la competencia",
        },
        prompt:
          "Analiza mi último video y sugiere mejoras para llegar a más gente...",
      },
      instagram: {
        title: "Agente de Instagram",
        description:
          "Crea contenido atractivo para Instagram. Redacción de descripciones, investigación de hashtags y estrategia de publicación.",
        capabilities: {
          a: "Redacción de descripciones",
          b: "Investigación de hashtags",
          c: "Ideas para Reels",
          d: "Estrategia de interacción",
        },
        prompt:
          "Escribe descripciones atractivas para mis fotos de viaje por Europa...",
      },
      tiktok: {
        title: "Agente de TikTok",
        description:
          "Crea contenido viral para TikTok. Sonidos en tendencia, fórmulas de gancho y estrategia de publicación.",
        capabilities: {
          a: "Redacción de ganchos",
          b: "Análisis de tendencias",
          c: "Calendario de publicación",
          d: "Investigación de hashtags",
        },
        prompt:
          "Genera 10 ganchos virales para mi nicho en la categoría de fitness...",
      },
    },
  },
  showcase: {
    eyebrow: "Generador de miniaturas",
    title: "Miniaturas que consiguen clics",
    description:
      "Genera miniaturas impactantes que invitan a hacer clic en segundos. Elige entre varios estilos de IA o describe el tuyo. No necesitas saber diseño.",
    styles: {
      cinematic: "Cinemático",
      neon: "Brillo neón",
      minimal: "Minimalista",
      bold: "Audaz y vivo",
      retro: "Gaming retro",
    },
    panelTitle: "Generar miniatura",
    describeLabel: "Describe tu miniatura",
    examplePrompt:
      "Miniatura gaming épica con luces de neón, iluminación dramática, texto grande superpuesto...",
    styleLabel: "Estilo",
    variation: "Variación {number}",
    generate: "Generar",
  },
  pricing: {
    eyebrow: "Precios",
    title: "Sistema de créditos flexible",
    subtitle:
      "Empieza con 100 créditos gratis. Compra más cuando quieras, sin suscripciones. Los precios se gestionan de forma dinámica desde el panel de administración.",
    mostPopular: "Más popular",
    perCredit: "{amount}¢ por crédito",
    plans: {
      free: {
        name: "Gratis",
        perCredit: "100 créditos gratis",
        description: "Empieza a crear con 100 créditos gratis",
        features: {
          a: "Acceso a las herramientas gratuitas",
          b: "Proveedores básicos incluidos",
          c: "Soporte de la comunidad",
        },
        cta: "Empieza gratis",
      },
      payg: {
        name: "Pago por uso",
        description: "Compra créditos cuando quieras, sin compromiso",
        features: {
          a: "Acceso a todas las herramientas",
          b: "Proveedores básicos incluidos",
          c: "Soporte de la comunidad",
          d: "Historial de 30 días",
        },
        cta: "Comprar créditos",
      },
      starter: {
        name: "Starter",
        description: "La mejor opción para empezar",
        features: {
          a: "Todos los proveedores de IA estándar",
          b: "Proveedores premium incluidos",
          c: "Soporte prioritario",
          d: "Historial ilimitado",
          e: "Acceso a la API",
          f: "Generación por lotes",
        },
        cta: "Obtener Starter",
      },
      pro: {
        name: "Pro",
        description: "Máximos créditos para usuarios avanzados",
        features: {
          a: "Todos los proveedores de IA estándar y premium",
          b: "Todo lo incluido en Starter",
          c: "El menor costo por crédito",
          d: "Soporte dedicado",
          e: "Integraciones personalizadas",
          f: "Panel de analítica",
        },
        cta: "Obtener Pro",
      },
    },
    costTitle: "Costo por herramienta",
    costs: {
      xTrends: {
        tool: "Investigación de tendencias en X",
        description: "Análisis de tendencias con IA y análisis de sentimiento",
      },
      xPost: {
        tool: "Publicar en X",
        description: "Genera y publica tweets con tu estilo (RAG)",
      },
      thumbnail: {
        tool: "Generador de miniaturas",
        description: "Por generación",
      },
      video: { tool: "Generador de videos", description: "Por video generado" },
      translator: {
        tool: "Traductor de contenido",
        description: "Por traducción",
      },
    },
    costNote: "Los costos pueden variar según el proveedor de IA seleccionado",
  },
  faq: {
    eyebrow: "Preguntas frecuentes",
    title: "Preguntas frecuentes",
    items: {
      what: {
        question: "¿Qué es Creator Hub?",
        answer:
          "Creator Hub es una plataforma con IA para creadores de contenido. Combina herramientas de IA (generación de miniaturas, generación de videos, traducción de contenido) con agentes de IA especializados (YouTube, Twitch, TikTok) para ayudarte a crear, optimizar y publicar contenido más rápido.",
      },
      design: {
        question:
          "¿Necesito saber diseño para usar el Generador de miniaturas?",
        answer:
          "No. Solo describe lo que quieres con tus palabras y la IA genera miniaturas profesionales. Puedes elegir entre estilos predefinidos o describir tu propia idea. No necesitas saber diseño.",
      },
      models: {
        question: "¿Qué modelos de IA usan?",
        answer:
          "Usamos una combinación de modelos de última generación, como Wan AI para generar videos y varios proveedores de LLM para texto y traducción. Añadimos nuevos modelos constantemente a medida que están disponibles.",
      },
      credits: {
        question: "¿Cómo funciona el sistema de créditos?",
        answer:
          "Empiezas con 100 créditos gratis. Cada herramienta tiene un costo distinto: Generador de miniaturas (~10 créditos), Generador de videos (~50 créditos), Traductor de contenido (~5 créditos). Puedes comprar más créditos cuando quieras, sin necesidad de suscripción.",
      },
      cancel: {
        question: "¿Puedo cancelar cuando quiera?",
        answer:
          "Sí. Como usamos un sistema de créditos sin suscripciones, no hay nada que cancelar. Compra créditos cuando los necesites y úsalos a tu ritmo.",
      },
      platforms: {
        question: "¿Qué plataformas admiten los agentes de IA?",
        answer:
          "Nuestros agentes de IA están especializados en YouTube, Twitch y TikTok. Cada agente conoce las mejores prácticas de su plataforma y te ayuda a optimizar tu contenido para lograr el máximo alcance e interacción.",
      },
    },
  },
  footer: {
    tagline: "El sistema operativo con IA para creadores de contenido.",
    groups: {
      product: "Producto",
      resources: "Recursos",
      company: "Empresa",
    },
    links: {
      thumbnail: "Generador de miniaturas",
      video: "Generador de videos",
      translator: "Traductor de contenido",
      agents: "Agentes de IA",
      pricing: "Precios",
      docs: "Documentación",
      blog: "Blog",
      changelog: "Novedades",
      status: "Estado",
      about: "Acerca de",
      contact: "Contacto",
      privacy: "Privacidad",
      terms: "Términos",
    },
    rights: "© {year} Creator Hub. Todos los derechos reservados.",
    developedBy: "Plataforma desarrollada por <link>cesargarces.com</link>",
    social: {
      x: "Creator Hub en X",
      github: "Creator Hub en GitHub",
      discord: "Creator Hub en Discord",
    },
  },
};
