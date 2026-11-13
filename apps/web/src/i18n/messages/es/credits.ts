import type { Messages } from "../../translate";

export const credits: Messages["credits"] = {
  currentBalance: "Saldo actual",
  lifetimeEarned: "Total histórico: {count} créditos obtenidos",
  buyMore: "Comprar más créditos",
  transactionHistory: "Historial de transacciones",
  noTransactions: "Aún no hay transacciones",
  pending: "Pendiente",
  completed: "Completado",
  amount_one: "{sign}{count} crédito",
  amount_other: "{sign}{count} créditos",
  creditPlans: "Planes de créditos",
  subscriptionPlans: "Planes de suscripción",
  popular: "Popular",
  planCredits: "{count} créditos",
  perCredit: "{amount}¢ por crédito",
  processing: "Procesando...",
  buyCredits: "Comprar créditos",
  perMonth: "/mes",
  creditsPerMonth: "{count} créditos/mes",
  currentPlan: "Plan actual",
  subscribe: "Suscribirse",
  checkoutTitle: "Empieza ahora",
  checkoutTitleAlt: "¡Vamos allá! 🚀",
  buyModal: {
    title: "Comprar créditos",
    description:
      "Ingresa el monto en dólares (mínimo $10). Los créditos se calculan según la tarifa del plan Pago por uso.",
    descriptionSimple:
      "Ingresa el monto en dólares (mínimo $10). Cada dólar equivale a 1 crédito.",
    amountLabel: "Monto en dólares estadounidenses",
    approximately: "Recibirás aproximadamente {count} créditos",
    exactly: "Recibirás {count} créditos",
    pay: "Pagar {amount}",
  },
  paymentStatus: {
    success: {
      title: "Pago realizado",
      message:
        "Tus créditos se añadieron a tu cuenta. ¡Ya puedes empezar a crear!",
    },
    failed: {
      title: "El pago falló",
      message:
        "No pudimos procesar tu pago. Inténtalo de nuevo o usa otro método.",
    },
    pending: {
      title: "Procesando el pago",
      message:
        "Estamos verificando tu pago. Los créditos se añadirán en breve.",
    },
    startCreating: "Empezar a crear",
    tryAgain: "Intentar de nuevo",
  },
  checkout: {
    defaultTitle: "Completar pago",
    selectedPlan: "Plan seleccionado",
    missingConfig:
      "Falta la configuración de pagos. Ponte en contacto con soporte.",
    preparing: "Preparando el entorno de pago seguro...",
  },
  planCatalog: {
    PAY_AS_YOU_GO: {
      name: "Pago por uso",
      description: "Compra créditos cuando quieras, sin compromiso",
    },
    STARTER: {
      name: "Starter",
      description: "La mejor opción para empezar",
    },
    PRO: {
      name: "Pro",
      description: "Máximos créditos para usuarios avanzados",
    },
  },
};
