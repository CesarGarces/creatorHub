import type { Messages } from "../../translate";

export const common: Messages["common"] = {
  appName: "Creator Hub",
  appDescription: "Herramientas con IA para creadores de contenido",
  actions: {
    cancel: "Cancelar",
    saveChanges: "Guardar cambios",
    close: "Cerrar",
    tryAgain: "Intentar de nuevo",
    copy: "Copiar",
    copyUrl: "Copiar URL",
    download: "Descargar",
    viewAll: "Ver todo →",
    generating: "Generando...",
    generateNew: "Generar nuevo",
  },
  status: {
    loading: "Cargando...",
    pending: "Pendiente",
    completed: "Completado",
    unknownError: "Error desconocido",
  },
  time: {
    justNow: "Justo ahora",
  },
  credits: {
    count_one: "{count} crédito",
    count_other: "{count} créditos",
    cost_one: "⚡ {count} crédito",
    cost_other: "⚡ {count} créditos",
  },
  toasts: {
    urlCopied: "URL copiada al portapapeles",
    downloadStarted: "Descarga iniciada",
    downloadFailed: "Error en la descarga",
  },
  plans: {
    FREE: "PLAN GRATIS",
    PAY_AS_YOU_GO: "PAGO POR USO",
    PREMIUM: "PREMIUM",
    STARTER: "STARTER",
    PRO: "PRO",
  },
  enterToSend: "Enter para enviar",
  shiftEnterNewLine: "Shift+Enter para nueva línea",
};
