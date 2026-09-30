import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { AuthenticationError } from "@/lib/auth/errors";

const scrypt = promisify(scryptCallback) as unknown as (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number; maxmem?: number }) => Promise<Buffer>;
const VERSION = "scrypt";
const N = 1 << 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MAX_PASSWORD_BYTES = 1024;

function assertPassword(password: string) {
  if (typeof password !== "string") {
    throw new AuthenticationError("INVALID_INPUT", "Password input is invalid.");
  }
  const bytes = Buffer.byteLength(password, "utf8");
  if (bytes < 12 || bytes > MAX_PASSWORD_BYTES) {
    throw new AuthenticationError("INVALID_INPUT", "Password input is invalid.");
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPassword(password);
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return [VERSION, `ln=${Math.log2(N)}`, `r=${R}`, `p=${P}`, salt.toString("base64url"), derived.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  if (typeof password !== "string" || typeof encodedHash !== "string") return false;

  try {
    assertPassword(password);
    const [version, lnPart, rPart, pPart, saltPart, hashPart] = encodedHash.split("$");
    if (version !== VERSION || !lnPart || !rPart || !pPart || !saltPart || !hashPart) return false;

    const ln = Number(lnPart.replace("ln=", ""));
    const r = Number(rPart.replace("r=", ""));
    const p = Number(pPart.replace("p=", ""));
    if (!Number.isInteger(ln) || !Number.isInteger(r) || !Number.isInteger(p) || ln < 14 || ln > 20 || r < 1 || r > 32 || p < 1 || p > 8) return false;

    const salt = Buffer.from(saltPart, "base64url");
    const expected = Buffer.from(hashPart, "base64url");
    if (salt.length !== SALT_LENGTH || expected.length !== KEY_LENGTH) return false;

    const actual = await scrypt(password, salt, expected.length, { N: 1 << ln, r, p, maxmem: 128 * 1024 * 1024 });

    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
