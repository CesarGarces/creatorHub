import type { Messages } from "../../translate";

export const communityBot: Messages["communityBot"] = {
  title: "Bot da comunidade",
  description:
    "Conecte os canais da sua comunidade e deixe o bot responder aos seus fãs com a sua própria voz, usando seu perfil de estilo e o modelo de IA que você escolher. Cada resposta consome créditos como qualquer geração.",
  tabs: {
    channels: "Canais",
    behavior: "Comportamento",
    conversations: "Conversas",
    playground: "Testes",
  },
  socket: {
    channelConnected: "Canal conectado",
    channelConnectedAs: "Canal conectado como {identity}",
    channelFailed: "Falha na conexão do canal",
    outOfCredits:
      "Bot da comunidade pausado: seus créditos acabaram. Recarregue para continuar respondendo.",
    dailyLimit:
      "O bot da comunidade atingiu o limite diário de respostas que você configurou.",
  },
  status: {
    ACTIVE: "Conectado",
    CONNECTING: "Conectando…",
    AWAITING_QR: "Escaneie o QR code",
    DISCONNECTED: "Desconectado",
    REQUIRES_RESCAN: "É preciso vincular de novo",
    ERROR: "Erro",
  },
  channels: {
    instagramDescription:
      "Responda DMs e comentários pela API oficial da Meta.",
    phase: "Fase {number}",
    comingSoon: "Em breve",
    connecting: "Conectando…",
    disconnect: "Desconectar",
    telegram: {
      description:
        "Crie um bot com o <link>@BotFather</link> (grátis, 2 minutos) e cole o token aqui. O bot responde às mensagens privadas com a sua voz.",
      bot: "Bot:",
      tokenLabel: "Token do bot",
      hide: "Ocultar",
      show: "Mostrar",
      connect: "Conectar Telegram",
      pasteTokenFirst: "Primeiro cole o token do seu bot do @BotFather",
      tokenAccepted: "Token aceito — o worker está colocando seu bot online",
      failed: "Não foi possível conectar o Telegram",
      disconnected: "Bot do Telegram desconectado",
    },
    whatsapp: {
      description:
        "Vincule seu número pessoal do WhatsApp por QR code (como o WhatsApp Web). Ilimitado e grátis — sem taxas da API da Meta.",
      number: "Número:",
      scanQr: "Escaneie este QR code com o WhatsApp:",
      qrAlt: "QR code do WhatsApp",
      qrInstructions:
        "Abra o WhatsApp → Configurações → Aparelhos conectados → Conectar um aparelho",
      generatingQr: "Gerando QR code…",
      connect: "Conectar WhatsApp",
      failed: "Não foi possível conectar o WhatsApp",
      disconnected: "WhatsApp desconectado",
    },
  },
  behavior: {
    saved: "Configuração do bot salva",
    saveFailed: "Não foi possível salvar a configuração",
    engine: "Motor",
    autoReplies: "Respostas automáticas",
    autoRepliesHint:
      "Chave geral — quando desligada, as mensagens recebidas são armazenadas, mas nunca respondidas.",
    chatModel: "Modelo de chat",
    temperature: "Temperatura: {value}",
    temperatureHint: "Mais baixa = mais previsível, mais alta = mais criativa.",
    maxTokens: "Máximo de tokens por resposta",
    useStyle: "Usar meu perfil de estilo",
    useStyleHint:
      "Inclui seu tom, vocabulário e exemplos em cada resposta (treinado em Configurações → Estilo).",
    guardrails: "Limites e instruções",
    dailyLimit: "Limite diário de respostas",
    cooldown: "Intervalo por fã (segundos)",
    memory: "Memória da conversa (mensagens)",
    extraInstructions: "Instruções extras para o bot (opcional)",
    extraPlaceholder:
      'ex.: "Nunca fale de preços. Se alguém pedir parcerias, diga para me mandar um e-mail."',
    saving: "Salvando…",
    save: "Salvar configuração",
  },
  conversations: {
    emptyTitle: "Nenhuma conversa ainda",
    emptyDescription:
      "Quando seu bot estiver conectado e os fãs começarem a escrever, cada conversa aparecerá aqui.",
    selectThread: "Selecione uma conversa para ler a thread",
    botPrefix: "Bot: ",
    messages_one: "{count} mensagem",
    messages_other: "{count} mensagens",
    back: "Voltar para as conversas",
    creditsShort: "· {count} cr",
    skipped: "· ignorada ({reason})",
    deliveryFailed: "· falha na entrega",
  },
  playground: {
    title: "Veja como seu bot responde",
    placeholder:
      "Escreva uma mensagem como se fosse um fã… ex.: “Quando é a sua próxima live?”",
    generating: "Gerando…",
    testReply: "Testar resposta",
    hint: "Cada prévia executa uma geração real com o modelo configurado e custa os mesmos créditos de uma resposta ao vivo.",
    emptyTitle: "Nenhuma prévia ainda",
    emptyDescription:
      "Ajuste o modelo e as instruções na aba Comportamento e teste a voz aqui antes de ativar as respostas ao vivo.",
    fanSays: "O fã diz",
    botReplies: "Seu bot responde",
    meta_one: "{model} · {count} crédito · saldo {balance}",
    meta_other: "{model} · {count} créditos · saldo {balance}",
  },
  errors: {
    loadConfig: "Não foi possível carregar a configuração",
    saveConfig: "Não foi possível salvar a configuração",
    loadChannels: "Não foi possível carregar os canais",
    connectTelegram: "Não foi possível conectar o Telegram",
    connectWhatsApp: "Não foi possível conectar o WhatsApp",
    disconnect: "Não foi possível desconectar",
    loadConversations: "Não foi possível carregar as conversas",
    loadMessages: "Não foi possível carregar as mensagens",
    playground: "O teste falhou",
  },
};
