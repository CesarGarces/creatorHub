import type { Messages } from "../../translate";

export const share: Messages["share"] = {
  title: "Compartir recurso",
  close: "Cerrar",
  makePublicFirst: "Primero haz público el recurso para compartirlo",
  makePublicToLike: "Primero haz público el recurso para darle me gusta",
  linkCopied: "¡Enlace copiado al portapapeles!",
  copyFailed: "No se pudo copiar el enlace",
  nativeTitle: "Creado con Creator Hub",
  nativeTextImage: 'Mira esta imagen en Creator Hub: "{prompt}"',
  nativeTextVideo: 'Mira este video en Creator Hub: "{prompt}"',
  socialTextImage: "Mira esta imagen que hice en Creator Hub",
  socialTextVideo: "Mira este video que hice en Creator Hub",
  privateTitle: "Este recurso es privado",
  privateDescription:
    "Hazlo público para poder compartirlo y obtener un enlace que cualquiera pueda ver.",
  makePublicNow: "Hacerlo público ahora",
  shareLink: "Enlace para compartir",
  copied: "¡Copiado!",
  copy: "Copiar",
  shareOnSocial: "Compartir en redes sociales",
  shareViaDevice: "Compartir desde el dispositivo",
  publicFooter:
    "Cualquier persona con este enlace puede ver este recurso y darle me gusta",
  privateFooter: "Solo tú puedes ver este recurso hasta que lo hagas público",
  like: "Me gusta este recurso",
  unlike: "Ya no me gusta este recurso",
  page: {
    signIn: "Iniciar sesión",
    getStarted: "Empieza gratis",
    creatorFallback: "Creador",
    anonymousCreator: "Creador anónimo",
    createdOn: "Creado el {date}",
    video: "Video",
    image: "Imagen",
    share: "Compartir",
    copied: "¡Copiado!",
    copyLink: "Copiar enlace",
    likes_one: "{count} me gusta",
    likes_other: "{count} me gusta",
    views_one: "{count} visualización",
    views_other: "{count} visualizaciones",
    ctaTitle: "Crea algo increíble",
    ctaImage:
      "Esta impresionante imagen fue creada por <creator>{creator}</creator> con nuestras herramientas de IA. ¿Qué vas a crear tú?",
    ctaVideo:
      "Este impresionante video fue creado por <creator>{creator}</creator> con nuestras herramientas de IA. ¿Qué vas a crear tú?",
    creatorHubUser: "un usuario de Creator Hub",
    startCreating: "Empieza a crear gratis",
    freeCredits: "Incluye 100 créditos gratis",
    poweredBy:
      "Con la tecnología de <brand>Creator Hub</brand> — herramientas con IA para creadores de contenido",
  },
  meta: {
    notFoundTitle: "Recurso no encontrado | Creator Hub",
    notFoundDescription: "No se encontró este recurso o no es público.",
    videoTitle: 'Video: "{prompt}" | Creator Hub',
    imageTitle: '"{prompt}" | Creator Hub',
    descriptionImage:
      "Creado con {model} — imagen de {width}x{height} por {creator}. Únete gratis y crea la tuya.",
    descriptionVideo:
      "Creado con {model} — video de {width}x{height} por {creator}. Únete gratis y crea el tuyo.",
  },
};
