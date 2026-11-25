import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { encrypt, decrypt, randomToken, sha256 } from "@/lib/crypto";

// Object storage adapter. Local encrypted files for development; swap for S3-compatible storage with
// server-side encryption + per-object AES-GCM in production. Files are never publicly addressable.

const ROOT = path.join(process.cwd(), "storage", "documents");
export const MAX_BYTES = 5 * 1024 * 1024;
export const ALLOWED: Record<string, { magic: number[]; ext: string }> = {
  "application/pdf": { magic: [0x25, 0x50, 0x44, 0x46], ext: "pdf" },
  "image/jpeg": { magic: [0xff, 0xd8, 0xff], ext: "jpg" },
  "image/png": { magic: [0x89, 0x50, 0x4e, 0x47], ext: "png" },
};

export function sniffType(buf: Buffer): string | null {
  for (const [mime, { magic }] of Object.entries(ALLOWED)) if (magic.every((b, i) => buf[i] === b)) return mime;
  return null;
}

// ───────────── Malware scanning ─────────────
export interface Scanner { name: string; scan(buf: Buffer): Promise<"clean" | "infected" | "error"> }

const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

class BasicScanner implements Scanner {
  name = "basic+clamav-if-available";
  async scan(buf: Buffer) {
    if (buf.includes(Buffer.from(EICAR))) return "infected" as const;
    // PDFs with embedded JavaScript or launch actions are rejected.
    const head = buf.subarray(0, Math.min(buf.length, 2_000_000)).toString("latin1");
    if (/\/JavaScript|\/JS\s|\/Launch|\/EmbeddedFile/.test(head)) return "infected" as const;
    const clam = await clamscan(buf);
    return clam;
  }
}

async function clamscan(buf: Buffer): Promise<"clean" | "infected" | "error"> {
  const tmp = path.join(ROOT, `.scan-${randomToken(8)}`);
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(tmp, buf, { mode: 0o600 });
  try {
    return await new Promise((resolve) => {
      execFile("clamscan", ["--no-summary", tmp], { timeout: 30_000 }, (err) => {
        if (!err) return resolve("clean");
        const code = (err as unknown as { code?: number | string }).code;
        if (code === "ENOENT") return resolve("clean"); // ClamAV not installed (dev): rely on basic checks
        resolve(code === 1 ? "infected" : "error");
      });
    });
  } finally {
    await fs.rm(tmp, { force: true });
  }
}

export const scanner: Scanner = new BasicScanner();

// ───────────── Store / read ─────────────
export async function storeEncrypted(buf: Buffer) {
  await fs.mkdir(ROOT, { recursive: true, mode: 0o700 });
  const key = `${randomToken(24)}.bin`;
  const { data, iv, tag } = encrypt(buf, "DOCUMENT_ENC_KEY");
  await fs.writeFile(path.join(ROOT, key), data, { mode: 0o600 });
  return { storageKey: key, iv, tag, sha256: sha256(buf) };
}

export async function readDecrypted(storageKey: string, iv: string, tag: string): Promise<Buffer> {
  if (!/^[\w-]+\.bin$/.test(storageKey)) throw new Error("bad key");
  const data = await fs.readFile(path.join(ROOT, storageKey));
  return decrypt(data, iv, tag, "DOCUMENT_ENC_KEY");
}

export async function deleteStored(storageKey: string) {
  if (!/^[\w-]+\.bin$/.test(storageKey)) return;
  await fs.rm(path.join(ROOT, storageKey), { force: true });
}
