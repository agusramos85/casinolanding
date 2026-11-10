import { put } from "@vercel/blob";
import { createSignupRecord, SignupInputError } from "../lib/signup.mjs";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Método no permitido." });
    return;
  }

  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) {
    response.status(503).json({ error: "El almacenamiento privado aún no está configurado." });
    return;
  }

  try {
    const record = await createSignupRecord(request.body);
    await put(`signups/${record.id}.json`, JSON.stringify(record), {
      access: "private",
      contentType: "application/json",
    });

    response.status(201).json({ message: "Registro guardado." });
  } catch (error) {
    if (error instanceof SignupInputError) {
      response.status(400).json({ error: error.message });
      return;
    }

    console.error("No se pudo guardar el registro en Vercel Blob:", error);
    response.status(500).json({ error: "No se pudo guardar el registro. Inténtalo de nuevo más tarde." });
  }
}
