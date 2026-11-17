import type { Messages } from "../../translate";

export const videoClipper: Messages["videoClipper"] = {
  title: "Analizador de video con IA y recortes inteligentes",
  subtitle:
    "Encuentra los mejores momentos de tu video, obtén ganchos y títulos, y exporta clips cortos — sin subir tu video.",
  privacy:
    "Procesado en tu navegador: tu video nunca sale de tu dispositivo. Solo se envían a la IA fotogramas clave pequeños.",
  upload: {
    label: "Subir un video",
    title: "Suelta tu video aquí",
    subtitle: "MP4, MOV o WebM, hasta {max}",
    choose: "Elegir video",
    dropNow: "Suelta para cargar el video",
    errors: {
      type: "Este archivo no es un video. Elige un archivo MP4, MOV o WebM.",
      empty: "Este archivo está vacío.",
      size: "Este video pesa {size}. El recortador del navegador admite archivos de hasta {max}.",
      decode:
        "Tu navegador no puede leer este video. Prueba con un MP4 (H.264).",
      sampling:
        "No se pudieron extraer fotogramas clave de este video. Prueba con otro archivo.",
    },
    dismiss: "Cerrar",
  },
  roadmap: {
    badge: "Próximamente",
    title: "Archivos pesados de cámara de hasta 10 GB",
    description:
      "El soporte para originales de cámara grandes (4K, ProRes, hasta 10 GB) llegará en una próxima versión. Por ahora, exporta un MP4 más ligero (hasta 250 MB) desde tu editor o tu teléfono.",
  },
  video: {
    player: "Vista previa del video",
    change: "Cambiar video",
    remove: "Quitar video",
    reading: "Leyendo el video…",
    sampling: "Extrayendo fotogramas clave… {done}/{total}",
    keyframes_one: "{count} fotograma clave",
    keyframes_other: "{count} fotogramas clave",
    keyframesHint:
      "Tomados aproximadamente cada {interval} s y comprimidos en tu navegador.",
    keyframeAlt: "Fotograma clave en {time}",
    keyframesLabel: "Fotogramas clave",
    seekTo: "Ir a {time}",
    reattach:
      "Adjunta el video original ({name}) para previsualizar y exportar estos clips.",
  },
  analyze: {
    heading: "Analizar con IA",
    model: "Modelo de visión",
    noModels:
      "No hay ningún modelo de visión (multimodal) activo. Un administrador puede activarlo en Modelos de IA.",
    platform: "Clips para",
    platforms: {
      "youtube-shorts": "YouTube Shorts",
      tiktok: "TikTok",
      "instagram-reels": "Instagram Reels",
      youtube: "YouTube",
    },
    platformHint: "Clips de {min}–{max} s",
    context: "¿De qué trata el video? (opcional)",
    contextPlaceholder: "p. ej. Receta: pasta fresca casera en 10 minutos",
    cost: "Este análisis cuesta {total} créditos",
    costFree: "Este análisis es gratis con este modelo",
    costBreakdown:
      "{model}: {modelCost} créditos × {units} (por cada 12 fotogramas) · {frames} fotogramas",
    balance: "Tu saldo: {balance} créditos",
    notEnough: "No tienes créditos suficientes para este análisis.",
    getCredits: "Conseguir créditos",
    submit: "Analizar video",
    analyzing: "Analizando {count} fotogramas clave con {model}…",
    cancel: "Cancelar",
    needVideo: "Agrega un video para empezar.",
    waitFrames: "Aún se están extrayendo los fotogramas clave…",
    charged_one: "Análisis listo · {count} crédito usado",
    charged_other: "Análisis listo · {count} créditos usados",
    chargedFree: "Análisis listo",
  },
  results: {
    summary: "Resumen",
    titles: "Ideas de título",
    hooks: "Ganchos",
    hashtags: "Hashtags",
    copy: "Copiar",
    copyItem: "Copiar «{text}»",
    copyAll: "Copiar todo",
    copied: "Copiado al portapapeles",
    copyFailed: "No se pudo copiar al portapapeles",
    model: "Analizado con {model}",
  },
  clips: {
    heading: "Clips detectados",
    count_one: "{count} clip",
    count_other: "{count} clips",
    timeline: "Línea de tiempo de clips",
    timelineClip: "Clip {index}, de {start} a {end}",
    handleStart: "Inicio del clip {index}",
    handleEnd: "Fin del clip {index}",
    timelineHint:
      "Arrastra los controles para recortar. Mantén pulsado el clip para moverlo; las flechas del teclado también funcionan.",
    timelineHintTouch:
      "Arrastra los controles para recortar. Mantén pulsado el clip y arrástralo para moverlo.",
    moved: "Clip {index} movido a {start} – {end}",
    untitled: "Clip {index}",
    score: "Puntuación {score}",
    length: "{seconds} s",
    preview: "Vista previa",
    stop: "Detener",
    export: "Exportar",
    exporting: "Exportando… {percent}%",
    cancelExport: "Cancelar exportación",
    exported: "Clip guardado en tu dispositivo",
    exportFailed: "No se pudo exportar el clip. Inténtalo de nuevo.",
    start: "Inicio",
    end: "Fin",
    startEarlier: "Empezar 1 segundo antes",
    startLater: "Empezar 1 segundo después",
    endEarlier: "Terminar 1 segundo antes",
    endLater: "Terminar 1 segundo después",
    resetTrim: "Restablecer recorte",
    trimmed: "Recortado",
    format: "Formato de exportación",
    formats: {
      original: "Original",
      vertical: "Vertical 9:16",
    },
    realtimeNote:
      "Los clips se graban en tiempo real en tu navegador (un clip de 30 s tarda unos 30 s). Mantén esta pestaña abierta.",
    unsupported:
      "Este navegador no puede exportar clips. Usa una versión reciente de Chrome, Edge, Firefox o Safari.",
    needVideo: "Adjunta el video para previsualizar y exportar",
  },
  history: {
    heading: "Análisis recientes",
    empty: "Tus análisis aparecerán aquí.",
    open: "Abrir el análisis de {name}",
    delete: "Eliminar el análisis de {name}",
    clips_one: "{count} clip",
    clips_other: "{count} clips",
    deleted: "Análisis eliminado",
  },
  leave: {
    notice:
      "Tu video solo se conserva en esta pestaña. Si recargas, cierras o sales de esta página, tendrás que agregarlo de nuevo.",
    noticeAnalysis:
      "Tu video solo se conserva en esta pestaña. Si recargas, cierras o sales de esta página, se eliminarán el video y este análisis. Los créditos ya usados no se reembolsan.",
    title: "¿Salir de esta página?",
    description:
      "Tu video solo se conserva en esta pestaña. Si sales, tendrás que agregarlo de nuevo.",
    descriptionAnalysis:
      "Tu video solo se conserva en esta pestaña. Si sales, se eliminarán el video y su análisis. Los créditos ya usados no se reembolsan.",
    confirm: "Salir de la página",
    confirmAnalysis: "Salir y eliminar",
    stay: "Quedarme",
  },
  errors: {
    failed: "El análisis falló. Inténtalo de nuevo.",
    notVision:
      "Este modelo no puede analizar fotogramas de video. Elige un modelo de visión.",
    invalidAnalysis:
      "El modelo no devolvió un análisis válido. Inténtalo de nuevo o elige otro modelo.",
    modelFailed:
      "El modelo de IA no pudo analizar este video. Inténtalo de nuevo o elige otro modelo.",
    tooLarge: "Los videos de más de 250 MB aún no son compatibles.",
    openFailed: "No se pudo abrir este análisis.",
    deleteFailed: "No se pudo eliminar este análisis.",
  },
};
