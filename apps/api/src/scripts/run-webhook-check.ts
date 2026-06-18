async function main() {
  const mockStrategy = {
    verifyWebhook: async () => ({
      isValid: true,
      gatewayTxId: "mp_tx_123",
      status: "SUCCESSFUL",
    }),
  } as any;

  const mockPaymentRegistry = {
    getGateway: () => mockStrategy,
  } as any;

  const mockCreditBilling = {
    reconcilePayment: async (_gw: any, verification: any) => {
      console.log("reconcilePayment called with", verification);
      return true;
    },
  } as any;

  // Simulate controller logic without importing heavy modules
  const rawBody = Buffer.from(JSON.stringify({ data: { id: "mp_tx_123" } }));
  const headers = { "x-signature": "ts=123,v1=abc" } as any;
  const body = { data: { id: "mp_tx_123" } };

  // simulate PaymentGateway enum resolution (just accept mercado-pago)
  const gatewayEnum = "MERCADO_PAGO" as any;

  const strategy = mockPaymentRegistry.getGateway(gatewayEnum);
  const verification = await strategy.verifyWebhook(headers, body, rawBody);

  if (!verification.isValid) {
    console.error("Webhook verification failed", verification);
    return process.exit(1);
  }

  if (verification.status === "SUCCESSFUL") {
    const ok = await mockCreditBilling.reconcilePayment(
      gatewayEnum,
      verification,
      body || rawBody,
    );
    if (!ok) {
      console.error("Reconciliation failed for webhook", verification);
      return process.exit(1);
    }
  }

  console.log("Webhook handled successfully");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
