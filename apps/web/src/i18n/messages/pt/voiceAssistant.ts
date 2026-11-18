import type { Messages } from "../../translate";

export const voiceAssistant: Messages["voiceAssistant"] = {
  title: "Robotina",
  titleLong: "Robotina — assistente de voz com IA",
  emptyDescription:
    "Converse sobre qualquer assunto, em voz alta. Fale em português, inglês ou espanhol e a Robotina responde com a voz dela, no seu idioma.",
  tapToTalk: "Toque na esfera para falar",
  status: {
    idle: "Toque para falar",
    listening: "Ouvindo…",
    thinking: "Pensando…",
    speaking: "Falando…",
  },
  orb: {
    talk: "Falar com a Robotina",
    finish: "Terminei de falar — enviar",
    interrupt: "Interromper a Robotina e falar",
  },
  stop: "Encerrar conversa",
  handsFree: "Modo conversa",
  handsFreeHint: "Depois de responder, a Robotina volta a ouvir",
  voiceNote:
    "A voz dela é Deepgram Aura, escolhida pelo idioma em que você fala — uma voz por idioma:",
  voiceSettings: "Voz",
  pricing: "Voz {stt} cr/s · Resposta 1 cr (falada: {tts} cr/s)",
  pricingShort: "{stt} cr/s de voz · {tts} cr/s resposta falada",
  openChat: "Abrir chat",
  hideHistory: "Ocultar histórico",
  showHistory: "Mostrar histórico",
  newChat: "Nova conversa",
  history: "Conversas",
  noConversations: "Nenhuma conversa ainda",
  untitled: "Sem título",
  deleteConversation: "Excluir conversa",
  modelSettings: "Configurações do modelo",
  inputPlaceholder: "Digite uma mensagem ou toque no microfone…",
  send: "Enviar",
  you: "Você",
  replay: "Ouvir de novo",
  spoken: "Falado",
  interrupted: "Interrompida",
  voiceFailed: "Voz indisponível — respondeu em texto",
  voiceOutOfCredits:
    "Créditos insuficientes para a voz dela — o resto vai em texto",
  voiceOutOfFreeMinutes: "Seus minutos grátis acabaram — o resto vai em texto",
  freeTier: {
    remainingMonthly_one:
      "Plano Free: resta {count} de {total} minutos com a Robotina este mês",
    remainingMonthly_other:
      "Plano Free: restam {count} de {total} minutos com a Robotina este mês",
    remainingTotal_one:
      "Plano Free: resta {count} de {total} minutos com a Robotina",
    remainingTotal_other:
      "Plano Free: restam {count} de {total} minutos com a Robotina",
    exhaustedTitle: "Você usou seus {total} minutos grátis com a Robotina",
    exhaustedTitleNoTotal: "Você usou seus minutos grátis com a Robotina",
    exhaustedMonthly:
      "Eles voltam em {date}. Melhore seu plano para falar com ela sem limites.",
    exhaustedLifetime:
      "Melhore seu plano para continuar falando com ela sem limites.",
    upgrade: "Melhorar plano para uso ilimitado",
    limitError:
      "Você usou todos os seus minutos grátis com a Robotina. Melhore seu plano para uso ilimitado.",
  },
  credits: "{count} cr",
  loading: "Carregando conversa…",
  suggestions: {
    day: "Oi Robotina! Como está o seu dia?",
    idea: "Me ajuda a pensar numa ideia para o meu próximo vídeo",
    explain: "Explique buracos negros com palavras simples",
    practice: "Can we practice English for a while?",
  },
  languages: {
    en: "Inglês",
    es: "Espanhol",
    pt: "Português",
  },
  actions: {
    running: {
      create: "Adicionando à sua agenda…",
      list: "Verificando sua agenda…",
      update: "Atualizando sua agenda…",
      delete: "Preparando a exclusão…",
      other: "Trabalhando nisso…",
    },
    created: "Adicionado à sua agenda",
    updated: "Atualizado na sua agenda",
    moved: "Antes: {time}",
    deleted: "Excluído da sua agenda",
    confirm: "Aguardando sua confirmação para excluir",
    confirmHint: "Diga “sim” para confirmar",
    projectCreated: "Projeto de vídeo criado",
    projectUpdated: "Projeto de vídeo atualizado",
    projectDeleted: "Projeto de vídeo excluído",
    projectSessions: "{done}/{total} sessões feitas",
    projectWithSessions: "Com suas {count} sessões",
    noPublishDate: "Sem data de publicação",
    publishOn: "Publica em {date}",
    projects: "Seus projetos de vídeo",
    noProjects: "Nenhum projeto de vídeo ainda",
    agenda: "Sua agenda",
    agendaEmpty: "Nada planejado",
    overlaps: "Conflita com {title}",
    openPlanner: "Abrir no planejador",
    more: "+{count} mais",
    failed: "Não foi possível concluir",
  },
  widget: {
    hint: "Toque na esfera e diga qualquer coisa: ela responde em voz alta.",
  },
  errors: {
    replyFailed: "A Robotina não conseguiu responder. Tente novamente.",
    modelFailed:
      "A Robotina não conseguiu responder. Tente novamente ou escolha outro modelo.",
    voiceUnsupported: "A entrada de voz não está disponível neste navegador.",
  },
};
