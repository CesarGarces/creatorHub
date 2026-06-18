Mercado Pago Webhooks

Overview

- Endpoint: POST /api/v1/webhooks/mercado-pago
- The API must verify payload authenticity before processing.

Expected header

- `x-signature`: expected format `ts=<timestamp>,v1=<hex>` where:
  - `ts` is a UNIX timestamp sent by Mercado Pago
  - `v1` is an HMAC-SHA256 hex digest

Verification algorithm (recommended)

1. Extract resource id from body: `body.data.id` or `body.id` or `body.resource.id` (gatewayTxId).
2. Parse `x-signature` into `ts` and `v1`.
3. Construct manifest string: `id:${gatewayTxId};ts:${ts};`.
4. Compute `hmac = HMAC-SHA256(secret, manifest)`.
5. Compare `hmac` with `v1` using `timingSafeEqual`.

Fallbacks

- If no webhook secret is configured, the service may verify the payment status via the Mercado Pago API (requires access token).
- In non-production environments, the webhook may be accepted for local testing convenience.

Environment variables

- `MERCADO_PAGO_WEBHOOK_SECRET` or `MP_WEBHOOK_SECRET`: secret used to validate webhook signatures.
- `MERCADO_PAGO_ACCESS_TOKEN` or `MP_ACCESS_TOKEN`: access token for SDK/API fallback.
- `MP_NOTIFICATION_URL`: explicit notification URL to set in preferences (optional).

Notes

- Always prefer verifying using the raw bytes or the exact manifest algorithm — do not rely on `JSON.stringify` of the parsed body.
- For maximum safety, require a webhook secret in production and return 400 for invalid signatures.
