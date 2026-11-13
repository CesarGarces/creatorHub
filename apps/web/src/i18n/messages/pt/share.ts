import type { Messages } from "../../translate";

export const share: Messages["share"] = {
  title: "Compartilhar recurso",
  close: "Fechar",
  makePublicFirst: "Torne o recurso público primeiro para compartilhá-lo",
  makePublicToLike: "Torne o recurso público primeiro para curti-lo",
  linkCopied: "Link copiado para a área de transferência!",
  copyFailed: "Não foi possível copiar o link",
  nativeTitle: "Criado com o Creator Hub",
  nativeTextImage: 'Veja esta imagem no Creator Hub: "{prompt}"',
  nativeTextVideo: 'Veja este vídeo no Creator Hub: "{prompt}"',
  socialTextImage: "Veja esta imagem que criei no Creator Hub",
  socialTextVideo: "Veja este vídeo que criei no Creator Hub",
  privateTitle: "Este recurso é privado",
  privateDescription:
    "Torne-o público para poder compartilhar e obter um link que qualquer pessoa possa ver.",
  makePublicNow: "Tornar público agora",
  shareLink: "Link de compartilhamento",
  copied: "Copiado!",
  copy: "Copiar",
  shareOnSocial: "Compartilhar nas redes sociais",
  shareViaDevice: "Compartilhar pelo dispositivo",
  publicFooter:
    "Qualquer pessoa com este link pode ver este recurso e curti-lo",
  privateFooter: "Só você pode ver este recurso até torná-lo público",
  like: "Curtir este recurso",
  unlike: "Descurtir este recurso",
  page: {
    signIn: "Entrar",
    getStarted: "Comece grátis",
    creatorFallback: "Criador",
    anonymousCreator: "Criador anônimo",
    createdOn: "Criado em {date}",
    video: "Vídeo",
    image: "Imagem",
    share: "Compartilhar",
    copied: "Copiado!",
    copyLink: "Copiar link",
    likes_one: "{count} curtida",
    likes_other: "{count} curtidas",
    views_one: "{count} visualização",
    views_other: "{count} visualizações",
    ctaTitle: "Crie algo incrível",
    ctaImage:
      "Esta imagem incrível foi criada por <creator>{creator}</creator> com nossas ferramentas de IA. O que você vai criar?",
    ctaVideo:
      "Este vídeo incrível foi criado por <creator>{creator}</creator> com nossas ferramentas de IA. O que você vai criar?",
    creatorHubUser: "um usuário do Creator Hub",
    startCreating: "Comece a criar grátis",
    freeCredits: "100 créditos grátis incluídos",
    poweredBy:
      "Desenvolvido por <brand>Creator Hub</brand> — ferramentas com IA para criadores de conteúdo",
  },
  meta: {
    notFoundTitle: "Recurso não encontrado | Creator Hub",
    notFoundDescription: "Este recurso não foi encontrado ou não é público.",
    videoTitle: 'Vídeo: "{prompt}" | Creator Hub',
    imageTitle: '"{prompt}" | Creator Hub',
    descriptionImage:
      "Criado com {model} — imagem de {width}x{height} por {creator}. Cadastre-se grátis e crie a sua.",
    descriptionVideo:
      "Criado com {model} — vídeo de {width}x{height} por {creator}. Cadastre-se grátis e crie o seu.",
  },
};
