import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import * as OTPAuth from "otpauth";
const derive = (password: string, salt: string, modern: boolean) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      modern ? { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 } : {},
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
export const opaqueToken = () => randomBytes(32).toString("hex");
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function equal(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, true);
  return `scrypt:131072:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, hash: string) {
  const parts = hash.split(":");
  const modern = parts[1] === "131072";
  const salt = parts[modern ? 2 : 1];
  const key = parts[modern ? 3 : 2];
  if (!salt || !key) return false;
  const derived = await derive(password, salt, modern);
  return equal(derived.toString("hex"), key);
}
export function encryptMfa(secret: string, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  return [
    iv.toString("hex"),
    cipher.update(secret, "utf8", "hex") + cipher.final("hex"),
    cipher.getAuthTag().toString("hex"),
  ].join(":");
}
export function decryptMfa(payload: string, key: string) {
  const [iv, data, tag] = payload.split(":");
  if (!iv || !data || !tag) throw new Error("MFA inválido");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "hex"),
    Buffer.from(iv, "hex"),
  );
  cipher.setAuthTag(Buffer.from(tag, "hex"));
  return cipher.update(data, "hex", "utf8") + cipher.final("utf8");
}
export function totp(secret: string, email: string) {
  return new OTPAuth.TOTP({
    issuer: "Atendente 24/7",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}
export function newMfa(email: string) {
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  return { secret, uri: totp(secret, email).toString() };
}
