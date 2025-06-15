import * as bcrypt from "bcrypt";
import * as crypto from "crypto";

export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length === 0) {
    throw new Error("Password cannot be empty");
  }
  return bcrypt.hash(password, 10);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateRandomToken(length = 32): string {
  return crypto.randomBytes(length).toString("hex");
}
