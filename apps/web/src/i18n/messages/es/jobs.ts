import type { Messages } from "../../translate";

export const jobs: Messages["jobs"] = {
  translationReady: "¡Traducción lista!",
  videoReady: "¡Video listo!",
  generationReady: "¡Generación lista!",
  translationFailed: "La traducción falló",
  videoFailed: "La generación del video falló",
  generationFailed: "La generación falló",
  translationTimeout: "La traducción tardó demasiado. Inténtalo de nuevo.",
  videoTimeout: "La generación del video tardó demasiado. Inténtalo de nuevo.",
  generationTimeout: "La generación tardó demasiado. Inténtalo de nuevo.",
  translationTimeoutDetail:
    "La traducción tardó demasiado. Es posible que el proveedor de IA no esté disponible.",
  videoTimeoutDetail:
    "La generación del video tardó demasiado. Es posible que el proveedor de IA no esté disponible.",
  generationTimeoutDetail:
    "La generación tardó demasiado. Es posible que el proveedor de IA no esté disponible.",
  sessionExpiredRedirect:
    "Tu sesión ha expirado. Redirigiendo al inicio de sesión...",
};
