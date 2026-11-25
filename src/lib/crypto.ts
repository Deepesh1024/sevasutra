import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";

function secret(): string {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 32) throw new Error("APP_SECRET must be set (32+ chars)");
  return s;
}

export const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
export const hmac = (data: string, purpose = "default") => createHmac("sha256", `${secret()}:${purpose}`).update(data).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const randomDigits = (n: number) => Array.from({ length: n }, () => randomInt(0, 10)).join("");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function key(name: "DOCUMENT_ENC_KEY" | "APP_SECRET"): Buffer {
  if (name === "DOCUMENT_ENC_KEY") {
    const k = process.env.DOCUMENT_ENC_KEY;
    if (!k || k.length !== 64) throw new Error("DOCUMENT_ENC_KEY must be 32 bytes hex");
    return Buffer.from(k, "hex");
  }
  return createHash("sha256").update(secret()).digest();
}

export function encrypt(plain: Buffer, keyName: "DOCUMENT_ENC_KEY" | "APP_SECRET" = "APP_SECRET") {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(keyName), iv);
  const data = Buffer.concat([c.update(plain), c.final()]);
  return { data, iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64") };
}

export function decrypt(data: Buffer, iv: string, tag: string, keyName: "DOCUMENT_ENC_KEY" | "APP_SECRET" = "APP_SECRET"): Buffer {
  const d = createDecipheriv("aes-256-gcm", key(keyName), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(data), d.final()]);
}

/** Compact string encryption for small secrets stored in the DB (e.g. TOTP seeds). */
export function encryptString(s: string): string {
  const { data, iv, tag } = encrypt(Buffer.from(s, "utf8"));
  return `${iv}.${tag}.${data.toString("base64")}`;
}
export function decryptString(s: string): string {
  const [iv, tag, data] = s.split(".");
  return decrypt(Buffer.from(data, "base64"), iv, tag).toString("utf8");
}

/** Signed, expiring token: payload.exp.sig (used for document links and unsubscribe links). */
export function signToken(payload: string, ttlSeconds: number, purpose: string): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = `${Buffer.from(payload).toString("base64url")}.${exp}`;
  return `${body}.${hmac(body, purpose).slice(0, 43)}`;
}
export function verifyToken(token: string, purpose: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [p, exp, sig] = parts;
  const body = `${p}.${exp}`;
  if (!safeEqual(sig, hmac(body, purpose).slice(0, 43))) return null;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
  return Buffer.from(p, "base64url").toString();
}
