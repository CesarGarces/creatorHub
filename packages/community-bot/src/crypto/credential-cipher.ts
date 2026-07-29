import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM
const VERSION = "v1";

/**
 * Symmetric encryption for channel credentials at rest (Telegram bot
 * tokens today, WhatsApp auth-state in the next phase).
 *
 * The key is derived from COMMUNITY_BOT_ENCRYPTION_KEY with SHA-256, so
 * any secret length is valid. Stored format:
 *   v1:<base64 iv>:<base64 authTag>:<base64 ciphertext>
 *
 * Both the API (writes credentials) and the community-worker (reads
 * them) share this implementation through the package — no duplicated
 * crypto logic.
 */
export class CredentialCipher {
  private readonly key: Buffer;

  constructor(secret: string) {
    if (!secret) {
      throw new Error(
        "COMMUNITY_BOT_ENCRYPTION_KEY is not set — channel credentials cannot be encrypted",
      );
    }
    this.key = createHash("sha256").update(secret, "utf8").digest();
  }

  static fromEnv(): CredentialCipher {
    return new CredentialCipher(process.env.COMMUNITY_BOT_ENCRYPTION_KEY || "");
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      VERSION,
      iv.toString("base64"),
      tag.toString("base64"),
      ciphertext.toString("base64"),
    ].join(":");
  }

  decrypt(payload: string): string {
    const [version, ivB64, tagB64, dataB64] = payload.split(":");
    if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
      throw new Error("Malformed encrypted credentials payload");
    }
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }

  encryptJson(value: unknown): string {
    return this.encrypt(JSON.stringify(value));
  }

  decryptJson<T>(payload: string): T {
    return JSON.parse(this.decrypt(payload)) as T;
  }
}
