import type { Messages } from "../../translate";

export const videoClipper: Messages["videoClipper"] = {
  title: "Analisador de vídeo com IA e cortes inteligentes",
  subtitle:
    "Encontre os melhores momentos do seu vídeo, receba ganchos e títulos e exporte clipes curtos — sem enviar o seu vídeo.",
  privacy:
    "Processado no seu navegador: o seu vídeo nunca sai do seu dispositivo. Apenas quadros-chave pequenos são enviados à IA.",
  upload: {
    label: "Enviar um vídeo",
    title: "Solte o seu vídeo aqui",
    subtitle: "MP4, MOV ou WebM, até {max}",
    choose: "Escolher vídeo",
    dropNow: "Solte para carregar o vídeo",
    errors: {
      type: "Este arquivo não é um vídeo. Escolha um arquivo MP4, MOV ou WebM.",
      empty: "Este arquivo está vazio.",
      size: "Este vídeo tem {size}. O cortador do navegador aceita arquivos de até {max}.",
      decode:
        "O seu navegador não consegue ler este vídeo. Tente um MP4 (H.264).",
      sampling:
        "Não foi possível extrair quadros-chave deste vídeo. Tente outro arquivo.",
    },
    dismiss: "Fechar",
  },
  roadmap: {
    badge: "Em breve",
    title: "Arquivos pesados de câmera de até 10 GB",
    description:
      "O suporte a originais de câmera grandes (4K, ProRes, até 10 GB) chegará em uma próxima versão. Por enquanto, exporte um MP4 mais leve (até 250 MB) do seu editor ou celular.",
  },
  video: {
    player: "Pré-visualização do vídeo",
    change: "Trocar vídeo",
    remove: "Remover vídeo",
    reading: "Lendo o vídeo…",
    sampling: "Extraindo quadros-chave… {done}/{total}",
    keyframes_one: "{count} quadro-chave",
    keyframes_other: "{count} quadros-chave",
    keyframesHint:
      "Capturados aproximadamente a cada {interval} s e comprimidos no seu navegador.",
    keyframeAlt: "Quadro-chave em {time}",
    keyframesLabel: "Quadros-chave",
    seekTo: "Ir para {time}",
    reattach:
      "Anexe o vídeo original ({name}) para pré-visualizar e exportar estes clipes.",
  },
  analyze: {
    heading: "Analisar com IA",
    model: "Modelo de visão",
    noModels:
      "Nenhum modelo de visão (multimodal) está ativo. Um administrador pode ativar um em Modelos de IA.",
    platform: "Clipes para",
    platforms: {
      "youtube-shorts": "YouTube Shorts",
      tiktok: "TikTok",
      "instagram-reels": "Instagram Reels",
      youtube: "YouTube",
    },
    platformHint: "Clipes de {min}–{max} s",
    context: "Sobre o que é o vídeo? (opcional)",
    contextPlaceholder: "ex.: Receita: massa fresca caseira em 10 minutos",
    cost: "Esta análise custa {total} créditos",
    costFree: "Esta análise é gratuita com este modelo",
    costBreakdown:
      "{model}: {modelCost} créditos × {units} (a cada 12 quadros) · {frames} quadros",
    balance: "Seu saldo: {balance} créditos",
    notEnough: "Você não tem créditos suficientes para esta análise.",
    getCredits: "Obter créditos",
    submit: "Analisar vídeo",
    analyzing: "Analisando {count} quadros-chave com {model}…",
    cancel: "Cancelar",
    needVideo: "Adicione um vídeo para começar.",
    waitFrames: "Os quadros-chave ainda estão sendo extraídos…",
    charged_one: "Análise pronta · {count} crédito usado",
    charged_other: "Análise pronta · {count} créditos usados",
    chargedFree: "Análise pronta",
  },
  results: {
    summary: "Resumo",
    titles: "Ideias de título",
    hooks: "Ganchos",
    hashtags: "Hashtags",
    copy: "Copiar",
    copyItem: "Copiar “{text}”",
    copyAll: "Copiar tudo",
    copied: "Copiado para a área de transferência",
    copyFailed: "Não foi possível copiar para a área de transferência",
    model: "Analisado com {model}",
  },
  clips: {
    heading: "Clipes detectados",
    count_one: "{count} clipe",
    count_other: "{count} clipes",
    timeline: "Linha do tempo dos clipes",
    timelineClip: "Clipe {index}, de {start} a {end}",
    handleStart: "Início do clipe {index}",
    handleEnd: "Fim do clipe {index}",
    timelineHint:
      "Arraste os controles para cortar. Mantenha o clipe pressionado para movê-lo; as setas do teclado também funcionam.",
    timelineHintTouch:
      "Arraste os controles para cortar. Mantenha o clipe pressionado e arraste-o para movê-lo.",
    moved: "Clipe {index} movido para {start} – {end}",
    untitled: "Clipe {index}",
    score: "Pontuação {score}",
    length: "{seconds} s",
    preview: "Pré-visualizar",
    stop: "Parar",
    export: "Exportar",
    exporting: "Exportando… {percent}%",
    cancelExport: "Cancelar exportação",
    exported: "Clipe salvo no seu dispositivo",
    exportFailed: "Não foi possível exportar o clipe. Tente novamente.",
    start: "Início",
    end: "Fim",
    startEarlier: "Começar 1 segundo antes",
    startLater: "Começar 1 segundo depois",
    endEarlier: "Terminar 1 segundo antes",
    endLater: "Terminar 1 segundo depois",
    resetTrim: "Restaurar corte",
    trimmed: "Cortado",
    format: "Formato de exportação",
    formats: {
      original: "Original",
      vertical: "Vertical 9:16",
    },
    realtimeNote:
      "Os clipes são gravados em tempo real no seu navegador (um clipe de 30 s leva cerca de 30 s). Mantenha esta aba aberta.",
    unsupported:
      "Este navegador não consegue exportar clipes. Use uma versão recente do Chrome, Edge, Firefox ou Safari.",
    needVideo: "Anexe o vídeo para pré-visualizar e exportar",
  },
  history: {
    heading: "Análises recentes",
    empty: "As suas análises aparecerão aqui.",
    open: "Abrir a análise de {name}",
    delete: "Excluir a análise de {name}",
    clips_one: "{count} clipe",
    clips_other: "{count} clipes",
    deleted: "Análise excluída",
  },
  leave: {
    notice:
      "O seu vídeo só fica guardado nesta aba. Se recarregar, fechar ou sair desta página, terá que adicioná-lo novamente.",
    noticeAnalysis:
      "O seu vídeo só fica guardado nesta aba. Se recarregar, fechar ou sair desta página, o vídeo e esta análise serão excluídos. Os créditos já usados não são reembolsados.",
    title: "Sair desta página?",
    description:
      "O seu vídeo só fica guardado nesta aba. Se sair, terá que adicioná-lo novamente.",
    descriptionAnalysis:
      "O seu vídeo só fica guardado nesta aba. Se sair, o vídeo e a sua análise serão excluídos. Os créditos já usados não são reembolsados.",
    confirm: "Sair da página",
    confirmAnalysis: "Sair e excluir",
    stay: "Ficar",
  },
  errors: {
    failed: "A análise falhou. Tente novamente.",
    notVision:
      "Este modelo não consegue analisar quadros de vídeo. Escolha um modelo de visão.",
    invalidAnalysis:
      "O modelo não retornou uma análise válida. Tente novamente ou escolha outro modelo.",
    modelFailed:
      "O modelo de IA não conseguiu analisar este vídeo. Tente novamente ou escolha outro modelo.",
    tooLarge: "Vídeos com mais de 250 MB ainda não são suportados.",
    openFailed: "Não foi possível abrir esta análise.",
    deleteFailed: "Não foi possível excluir esta análise.",
  },
};
