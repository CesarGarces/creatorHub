import type { Messages } from "../../translate";

export const errors: Messages["errors"] = {
  generic: "Algo deu errado. Tente novamente.",
  network:
    "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
  tooManyRequests: "Muitas tentativas. Aguarde um momento e tente novamente.",
  sessionExpired: "Sua sessão expirou. Entre novamente.",
  invalidCredentials: "E-mail ou senha inválidos",
  emailAlreadyRegistered: "Este e-mail já está cadastrado",
  currentPasswordIncorrect: "A senha atual está incorreta",
  noPasswordSet: "Esta conta não tem senha definida",
  passwordTooShort: "A senha deve ter pelo menos 8 caracteres",
  passwordsDoNotMatch: "As senhas não coincidem",
  invalidVerificationCode: "Código inválido. Tente novamente.",
  noVerificationPending:
    "Nenhum código de verificação pendente. Solicite um novo.",
  verificationExpired: "O código de verificação expirou. Solicite um novo.",
  emailAlreadyVerified: "Este e-mail já foi verificado",
  invalidResetToken: "Este link de redefinição é inválido ou expirou",
  waitSeconds_one: "Aguarde {count} segundo antes de solicitar um novo código",
  waitSeconds_other:
    "Aguarde {count} segundos antes de solicitar um novo código",
  userNotFound: "Usuário não encontrado",
  insufficientCredits: "Você não tem créditos suficientes para esta ação",
  providerUnavailable: "O modelo selecionado não está disponível no momento",
  promptRequired: "Digite um prompt",
  topicRequired: "Digite um tema",
  textRequired: "Digite algum texto",
  tweetTooLong: "As publicações não podem passar de 280 caracteres",
  minimumAmount: "O valor mínimo é de US$ 10",
  paymentUnavailable: "Os pagamentos não estão disponíveis no momento",
  xNotConfigured: "A integração com o X não está configurada",
  notFound: "O item não foi encontrado",
  assetNotPublic: "Este recurso não é público",
};
