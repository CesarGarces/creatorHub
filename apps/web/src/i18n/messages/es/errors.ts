import type { Messages } from "../../translate";

export const errors: Messages["errors"] = {
  generic: "Algo salió mal. Inténtalo de nuevo.",
  network:
    "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
  tooManyRequests:
    "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
  sessionExpired: "Tu sesión ha expirado. Inicia sesión de nuevo.",
  invalidCredentials: "Correo o contraseña incorrectos",
  emailAlreadyRegistered: "Este correo ya está registrado",
  currentPasswordIncorrect: "La contraseña actual es incorrecta",
  noPasswordSet: "Esta cuenta no tiene contraseña",
  passwordTooShort: "La contraseña debe tener al menos 8 caracteres",
  passwordsDoNotMatch: "Las contraseñas no coinciden",
  invalidVerificationCode: "Código no válido. Inténtalo de nuevo.",
  noVerificationPending:
    "No hay ningún código de verificación pendiente. Solicita uno nuevo.",
  verificationExpired:
    "El código de verificación ha expirado. Solicita uno nuevo.",
  emailAlreadyVerified: "Este correo ya está verificado",
  invalidResetToken:
    "Este enlace de restablecimiento no es válido o ha expirado",
  waitSeconds_one: "Espera {count} segundo antes de solicitar un nuevo código",
  waitSeconds_other:
    "Espera {count} segundos antes de solicitar un nuevo código",
  userNotFound: "Usuario no encontrado",
  insufficientCredits: "No tienes suficientes créditos para esta acción",
  providerUnavailable:
    "El modelo seleccionado no está disponible en este momento",
  promptRequired: "Escribe un prompt",
  topicRequired: "Escribe un tema",
  textRequired: "Escribe algún texto",
  tweetTooLong: "Las publicaciones no pueden superar los 280 caracteres",
  minimumAmount: "El monto mínimo es de $10",
  paymentUnavailable: "Los pagos no están disponibles en este momento",
  xNotConfigured: "La integración con X no está configurada",
  notFound: "No se encontró el elemento",
  assetNotPublic: "Este recurso no es público",
};
