export const credits = {
  currentBalance: "Current Balance",
  lifetimeEarned: "Lifetime: {count} credits earned",
  buyMore: "Buy More Credits",
  transactionHistory: "Transaction History",
  noTransactions: "No transactions yet",
  pending: "Pending",
  completed: "Completed",
  amount_one: "{sign}{count} credit",
  amount_other: "{sign}{count} credits",
  creditPlans: "Credit Plans",
  subscriptionPlans: "Subscription Plans",
  popular: "Popular",
  planCredits: "{count} credits",
  perCredit: "{amount}¢ per credit",
  processing: "Processing...",
  buyCredits: "Buy Credits",
  perMonth: "/mo",
  creditsPerMonth: "{count} credits/month",
  currentPlan: "Current Plan",
  subscribe: "Subscribe",
  checkoutTitle: "Get started now",
  checkoutTitleAlt: "Let's do this! 🚀",
  buyModal: {
    title: "Buy Credits",
    description:
      "Enter the amount in dollars (minimum $10). Credits are calculated based on the Pay as you go plan rate.",
    descriptionSimple:
      "Enter the amount in dollars (minimum $10). Each dollar equals 1 credit.",
    amountLabel: "Amount in US dollars",
    approximately: "You will receive approximately {count} credits",
    exactly: "You will receive {count} credits",
    pay: "Pay {amount}",
  },
  paymentStatus: {
    success: {
      title: "Payment Successful",
      message:
        "Your credits have been added to your account. You are ready to create!",
    },
    failed: {
      title: "Payment Failed",
      message:
        "We could not process your payment. Please try again or use a different method.",
    },
    pending: {
      title: "Processing Payment",
      message: "We are verifying your payment. Credits will be added shortly.",
    },
    startCreating: "Start Creating",
    tryAgain: "Try Again",
  },
  checkout: {
    defaultTitle: "Complete Payment",
    selectedPlan: "Selected Plan",
    missingConfig: "Payment configuration missing. Please contact support.",
    preparing: "Preparing secure payment environment...",
  },
  /** Names/descriptions of plans served by the API, keyed by slug. */
  planCatalog: {
    PAY_AS_YOU_GO: {
      name: "Pay as you go",
      description: "Buy credits anytime, no commitment",
    },
    STARTER: {
      name: "Starter",
      description: "Best value for getting started",
    },
    PRO: {
      name: "Pro",
      description: "Maximum credits for power users",
    },
  },
};
