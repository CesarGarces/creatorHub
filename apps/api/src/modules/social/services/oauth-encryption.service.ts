import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "crypto";
import { Logger } from "@creator-hub/shared-utils";

@Injectable()
export class OAuthEncryptionService {
  private logger = new Logger("OAuthEncryptionService");
  private key: Buffer;

  constructor() {
    const encryptionKey = process.env.X_SOCIAL_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new InternalServerErrorException(
        "X_SOCIAL_ENCRYPTION_KEY is not set",
      );
    }
    this.key = Buffer.from(encryptionKey, "hex");
    if (this.key.length !== 32) {
      throw new InternalServerErrorException(
        "X_SOCIAL_ENCRYPTION_KEY must be 32 bytes (64 hex chars)",
      );
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
  }

  decrypt(ciphertext: string): string {
    const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":");
    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new InternalServerErrorException("Invalid encrypted data format");
    }
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }
}
