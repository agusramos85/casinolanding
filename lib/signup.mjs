import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export class SignupInputError extends Error {}

export async function createSignupRecord(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new SignupInputError("La solicitud debe incluir los datos del registro.");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!name || name.length > 100) {
    throw new SignupInputError("Ingresa un nombre de entre 1 y 100 caracteres.");
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SignupInputError("Ingresa un correo electrónico válido.");
  }
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 128) {
    throw new SignupInputError("La contraseña debe tener al menos 8 caracteres y no superar los 128 bytes.");
  }

  const salt = randomBytes(16);
  const passwordHash = await scrypt(password, salt, 64);

  return {
    id: randomUUID(),
    name,
    email,
    createdAt: new Date().toISOString(),
    passwordHash: passwordHash.toString("base64url"),
    passwordSalt: salt.toString("base64url"),
    passwordHashAlgorithm: "scrypt",
  };
}
