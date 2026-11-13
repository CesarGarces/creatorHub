import type { Messages } from "../../translate";

export const communityBot: Messages["communityBot"] = {
  title: "Bot de comunidad",
  description:
    "Conecta los canales de tu comunidad y deja que el bot responda a tus fans con tu propia voz, usando tu perfil de estilo y el modelo de IA que elijas. Cada respuesta consume créditos como cualquier generación.",
  tabs: {
    channels: "Canales",
    behavior: "Comportamiento",
    conversations: "Conversaciones",
    playground: "Pruebas",
  },
  socket: {
    channelConnected: "Canal conectado",
    channelConnectedAs: "Canal conectado como {identity}",
    channelFailed: "Falló la conexión del canal",
    outOfCredits:
      "Bot de comunidad en pausa: te quedaste sin créditos. Recarga para que siga respondiendo.",
    dailyLimit:
      "El bot de comunidad alcanzó el límite diario de respuestas que configuraste.",
  },
  status: {
    ACTIVE: "Conectado",
    CONNECTING: "Conectando…",
    AWAITING_QR: "Escanea el código QR",
    DISCONNECTED: "Desconectado",
    REQUIRES_RESCAN: "Hay que volver a vincular",
    ERROR: "Error",
  },
  channels: {
    instagramDescription:
      "Responde mensajes directos y comentarios mediante la API oficial de Meta.",
    phase: "Fase {number}",
    comingSoon: "Próximamente",
    connecting: "Conectando…",
    disconnect: "Desconectar",
    telegram: {
      description:
        "Crea un bot con <link>@BotFather</link> (gratis, 2 minutos) y pega el token aquí. El bot responde a los mensajes privados con tu voz.",
      bot: "Bot:",
      tokenLabel: "Token del bot",
      hide: "Ocultar",
      show: "Mostrar",
      connect: "Conectar Telegram",
      pasteTokenFirst: "Primero pega el token de tu bot de @BotFather",
      tokenAccepted: "Token aceptado: el worker está poniendo tu bot en línea",
      failed: "No se pudo conectar Telegram",
      disconnected: "Bot de Telegram desconectado",
    },
    whatsapp: {
      description:
        "Vincula tu número personal de WhatsApp con un código QR (como WhatsApp Web). Ilimitado y gratis, sin tarifas de la API de Meta.",
      number: "Número:",
      scanQr: "Escanea este código QR con WhatsApp:",
      qrAlt: "Código QR de WhatsApp",
      qrInstructions:
        "Abre WhatsApp → Configuración → Dispositivos vinculados → Vincular un dispositivo",
      generatingQr: "Generando código QR…",
      connect: "Conectar WhatsApp",
      failed: "No se pudo conectar WhatsApp",
      disconnected: "WhatsApp desconectado",
    },
  },
  behavior: {
    saved: "Configuración del bot guardada",
    saveFailed: "No se pudo guardar la configuración",
    engine: "Motor",
    autoReplies: "Respuestas automáticas",
    autoRepliesHint:
      "Interruptor general: si está apagado, los mensajes entrantes se guardan pero nunca se responden.",
    chatModel: "Modelo de chat",
    temperature: "Temperatura: {value}",
    temperatureHint: "Más baja = más predecible, más alta = más creativa.",
    maxTokens: "Tokens máximos por respuesta",
    useStyle: "Usar mi perfil de estilo",
    useStyleHint:
      "Incluye tu tono, vocabulario y ejemplos en cada respuesta (entrenado en Configuración → Estilo).",
    guardrails: "Límites e instrucciones",
    dailyLimit: "Límite diario de respuestas",
    cooldown: "Tiempo de espera por fan (segundos)",
    memory: "Memoria de conversación (mensajes)",
    extraInstructions: "Instrucciones adicionales para el bot (opcional)",
    extraPlaceholder:
      'p. ej. "Nunca hables de precios. Si alguien pide colaboraciones, dile que me escriba un correo."',
    saving: "Guardando…",
    save: "Guardar configuración",
  },
  conversations: {
    emptyTitle: "Aún no hay conversaciones",
    emptyDescription:
      "Cuando tu bot esté conectado y los fans empiecen a escribir, cada intercambio aparecerá aquí.",
    selectThread: "Selecciona una conversación para leer el hilo",
    botPrefix: "Bot: ",
    messages_one: "{count} mensaje",
    messages_other: "{count} mensajes",
    back: "Volver a las conversaciones",
    creditsShort: "· {count} cr",
    skipped: "· omitido ({reason})",
    deliveryFailed: "· no se pudo entregar",
  },
  playground: {
    title: "Previsualiza cómo responde tu bot",
    placeholder:
      "Escribe un mensaje como si fueras un fan… p. ej. “¿Cuándo es tu próximo stream?”",
    generating: "Generando…",
    testReply: "Probar respuesta",
    hint: "Cada vista previa ejecuta una generación real con tu modelo configurado y cuesta los mismos créditos que una respuesta en vivo.",
    emptyTitle: "Aún no hay vistas previas",
    emptyDescription:
      "Ajusta el modelo y las instrucciones en la pestaña Comportamiento y prueba la voz aquí antes de activar las respuestas en vivo.",
    fanSays: "El fan dice",
    botReplies: "Tu bot responde",
    meta_one: "{model} · {count} crédito · saldo {balance}",
    meta_other: "{model} · {count} créditos · saldo {balance}",
  },
  errors: {
    loadConfig: "No se pudo cargar la configuración",
    saveConfig: "No se pudo guardar la configuración",
    loadChannels: "No se pudieron cargar los canales",
    connectTelegram: "No se pudo conectar Telegram",
    connectWhatsApp: "No se pudo conectar WhatsApp",
    disconnect: "No se pudo desconectar",
    loadConversations: "No se pudieron cargar las conversaciones",
    loadMessages: "No se pudieron cargar los mensajes",
    playground: "Falló la prueba",
  },
};
