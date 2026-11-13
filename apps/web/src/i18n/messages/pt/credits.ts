import type { Messages } from "../../translate";

export const credits: Messages["credits"] = {
  currentBalance: "Saldo atual",
  lifetimeEarned: "Total acumulado: {count} créditos ganhos",
  buyMore: "Comprar mais créditos",
  transactionHistory: "Histórico de transações",
  noTransactions: "Nenhuma transação ainda",
  pending: "Pendente",
  completed: "Concluído",
  amount_one: "{sign}{count} crédito",
  amount_other: "{sign}{count} créditos",
  creditPlans: "Planos de créditos",
  subscriptionPlans: "Planos de assinatura",
  popular: "Popular",
  planCredits: "{count} créditos",
  perCredit: "{amount}¢ por crédito",
  processing: "Processando...",
  buyCredits: "Comprar créditos",
  perMonth: "/mês",
  creditsPerMonth: "{count} créditos/mês",
  currentPlan: "Plano atual",
  subscribe: "Assinar",
  checkoutTitle: "Comece agora",
  checkoutTitleAlt: "Vamos lá! 🚀",
  buyModal: {
    title: "Comprar créditos",
    description:
      "Informe o valor em dólares (mínimo de US$ 10). Os créditos são calculados com base na tarifa do plano Pague conforme usar.",
    descriptionSimple:
      "Informe o valor em dólares (mínimo de US$ 10). Cada dólar equivale a 1 crédito.",
    amountLabel: "Valor em dólares americanos",
    approximately: "Você receberá aproximadamente {count} créditos",
    exactly: "Você receberá {count} créditos",
    pay: "Pagar {amount}",
  },
  paymentStatus: {
    success: {
      title: "Pagamento aprovado",
      message:
        "Seus créditos foram adicionados à sua conta. Você já pode começar a criar!",
    },
    failed: {
      title: "O pagamento falhou",
      message:
        "Não conseguimos processar seu pagamento. Tente novamente ou use outro método.",
    },
    pending: {
      title: "Processando pagamento",
      message:
        "Estamos verificando seu pagamento. Os créditos serão adicionados em breve.",
    },
    startCreating: "Começar a criar",
    tryAgain: "Tentar novamente",
  },
  checkout: {
    defaultTitle: "Concluir pagamento",
    selectedPlan: "Plano selecionado",
    missingConfig:
      "Configuração de pagamento ausente. Entre em contato com o suporte.",
    preparing: "Preparando o ambiente de pagamento seguro...",
  },
  planCatalog: {
    PAY_AS_YOU_GO: {
      name: "Pague conforme usar",
      description: "Compre créditos quando quiser, sem compromisso",
    },
    STARTER: {
      name: "Starter",
      description: "O melhor custo-benefício para começar",
    },
    PRO: {
      name: "Pro",
      description: "Máximo de créditos para usuários avançados",
    },
  },
};
