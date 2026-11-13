export const communityBot = {
  title: "Community Bot",
  description:
    "Connect your community channels and let the bot reply to your fans in your own voice, powered by your style profile and the AI model of your choice. Each reply costs credits like any generation.",
  tabs: {
    channels: "Channels",
    behavior: "Behavior",
    conversations: "Conversations",
    playground: "Playground",
  },
  socket: {
    channelConnected: "Channel connected",
    channelConnectedAs: "Channel connected as {identity}",
    channelFailed: "Channel connection failed",
    outOfCredits:
      "Community bot paused: you ran out of credits. Top up to keep replying.",
    dailyLimit: "Community bot hit the daily reply limit you configured.",
  },
  status: {
    ACTIVE: "Connected",
    CONNECTING: "Connecting…",
    AWAITING_QR: "Scan QR code",
    DISCONNECTED: "Disconnected",
    REQUIRES_RESCAN: "Re-link required",
    ERROR: "Error",
  },
  channels: {
    instagramDescription:
      "Reply to DMs and comments through the official Meta API.",
    phase: "Phase {number}",
    comingSoon: "Coming soon",
    connecting: "Connecting…",
    disconnect: "Disconnect",
    telegram: {
      description:
        "Create a bot with <link>@BotFather</link> (free, 2 minutes) and paste the token here. The bot replies to private messages in your voice.",
      bot: "Bot:",
      tokenLabel: "Bot token",
      hide: "Hide",
      show: "Show",
      connect: "Connect Telegram",
      pasteTokenFirst: "Paste your bot token from @BotFather first",
      tokenAccepted: "Token accepted — the worker is bringing your bot online",
      failed: "Failed to connect Telegram",
      disconnected: "Telegram bot disconnected",
    },
    whatsapp: {
      description:
        "Link your personal WhatsApp number via QR code (like WhatsApp Web). Unlimited and free — no Meta API fees.",
      number: "Number:",
      scanQr: "Scan this QR code with WhatsApp:",
      qrAlt: "WhatsApp QR Code",
      qrInstructions:
        "Open WhatsApp → Settings → Linked Devices → Link a Device",
      generatingQr: "Generating QR code…",
      connect: "Connect WhatsApp",
      failed: "Failed to connect WhatsApp",
      disconnected: "WhatsApp disconnected",
    },
  },
  behavior: {
    saved: "Bot configuration saved",
    saveFailed: "Could not save the configuration",
    engine: "Engine",
    autoReplies: "Auto-replies",
    autoRepliesHint:
      "Master switch — when off, incoming messages are stored but never answered.",
    chatModel: "Chat model",
    temperature: "Temperature: {value}",
    temperatureHint: "Lower = more predictable, higher = more creative.",
    maxTokens: "Max reply tokens",
    useStyle: "Use my style profile",
    useStyleHint:
      "Inject your tone, vocabulary and samples into every reply (trained in Settings → Style).",
    guardrails: "Guardrails & instructions",
    dailyLimit: "Daily reply limit",
    cooldown: "Cooldown per fan (seconds)",
    memory: "Conversation memory (messages)",
    extraInstructions: "Extra instructions for the bot (optional)",
    extraPlaceholder:
      'e.g. "Never discuss pricing. If someone asks for collabs, tell them to email me."',
    saving: "Saving…",
    save: "Save configuration",
  },
  conversations: {
    emptyTitle: "No conversations yet",
    emptyDescription:
      "Once your bot is connected and fans start writing, every exchange will appear here.",
    selectThread: "Select a conversation to read the thread",
    botPrefix: "Bot: ",
    messages_one: "{count} message",
    messages_other: "{count} messages",
    back: "Back to conversations",
    creditsShort: "· {count} cr",
    skipped: "· skipped ({reason})",
    deliveryFailed: "· delivery failed",
  },
  playground: {
    title: "Preview how your bot replies",
    placeholder:
      "Write a message as if you were a fan… e.g. “When is your next stream?”",
    generating: "Generating…",
    testReply: "Test reply",
    hint: "Each preview runs a real generation with your configured model and costs the same credits as a live reply.",
    emptyTitle: "No previews yet",
    emptyDescription:
      "Tune the model and instructions in the Behavior tab, then test the voice here before enabling live replies.",
    fanSays: "Fan says",
    botReplies: "Your bot replies",
    meta_one: "{model} · {count} credit · balance {balance}",
    meta_other: "{model} · {count} credits · balance {balance}",
  },
  errors: {
    loadConfig: "Failed to load config",
    saveConfig: "Failed to save config",
    loadChannels: "Failed to load channels",
    connectTelegram: "Failed to connect Telegram",
    connectWhatsApp: "Failed to connect WhatsApp",
    disconnect: "Failed to disconnect",
    loadConversations: "Failed to load conversations",
    loadMessages: "Failed to load messages",
    playground: "Playground failed",
  },
};
