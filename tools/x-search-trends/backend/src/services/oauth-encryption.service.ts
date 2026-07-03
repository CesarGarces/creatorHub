import { Injectable } from "@nestjs/common";
import { Logger } from "@creator-hub/shared-utils";
import * as crypto from "crypto";

@Injectable()
export class OAuthEncryptionService {
  private logger = new Logger("OAuthEncryptionService");
  private readonly algorithm = "aes-256-gcm";
  private readonly key: Buffer;

  constructor() {
    const keyHex = process.env.X_SOCIAL_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
      this.logger.warn(
        "X_SOCIAL_ENCRYPTION_KEY not configured or invalid length. Using default key for development.",
      );
      // Generate a default key for development (not for production!)
      this.key = crypto.randomBytes(32);
    } else {
      this.key = Buffer.from(keyHex, "hex");
    }
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Format: iv_hex:authTag_hex:encrypted_hex
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid ciphertext format");
    }

    const ivHex = parts[0];
    const authTagHex = parts[1];
    const encrypted = parts[2];

    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error("Invalid ciphertext format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}
