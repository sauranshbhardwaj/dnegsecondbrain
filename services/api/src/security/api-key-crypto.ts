import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type EncryptedApiKey = {
  version: 1;
  iv: string;
  authTag: string;
  ciphertext: string;
};

export function encryptApiKey(apiKey: string, secret: string | undefined): EncryptedApiKey {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64")
  };
}

export function decryptApiKey(payload: EncryptedApiKey, secret: string | undefined): string {
  if (payload.version !== 1) {
    throw new Error("Unsupported encrypted API key version");
  }

  const key = deriveKey(secret);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final()
  ]).toString("utf8");
}

function deriveKey(secret: string | undefined): Buffer {
  if (!secret || secret.length < 16) {
    throw new Error("API_KEY_ENCRYPTION_SECRET must be at least 16 characters");
  }
  return createHash("sha256").update(secret).digest();
}
