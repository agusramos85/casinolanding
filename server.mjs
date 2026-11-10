import { createServer } from "node:http";
import { mkdir, open, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSignupRecord, SignupInputError } from "./lib/signup.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const dataDirectory = process.env.SIGNUP_DATA_DIR ?? join(root, "private-data");
const signupFile = join(dataDirectory, "signups.txt");
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const maxRequestBytes = 16 * 1024;

function respond(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let length = 0;

  for await (const chunk of request) {
    length += chunk.length;
    if (length > maxRequestBytes) {
      const error = new Error("La solicitud es demasiado grande.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("La solicitud debe contener JSON válido.");
    error.status = 400;
    throw error;
  }
}

async function saveSignup(request, response) {
  if (!request.headers["content-type"]?.includes("application/json")) {
    respond(response, 415, { error: "El tipo de contenido debe ser application/json." });
    return;
  }

  const body = await readJson(request);
  const record = await createSignupRecord(body);

  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
  const file = await open(signupFile, "a", 0o600);
  try {
    await file.chmod(0o600);
    await file.writeFile(`${JSON.stringify(record)}\n`, "utf8");
  } finally {
    await file.close();
  }

  respond(response, 201, { message: "Registro guardado." });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

  try {
    if (request.method === "POST" && url.pathname === "/api/signup") {
      await saveSignup(request, response);
      return;
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(await readFile(join(root, "index.html")));
      return;
    }

    respond(response, 404, { error: "No encontrado." });
  } catch (error) {
    if (error instanceof SignupInputError) {
      respond(response, 400, { error: error.message });
      return;
    }
    if (error.status) {
      respond(response, error.status, { error: error.message });
      return;
    }
    console.error("Signup request failed:", error);
    respond(response, 500, { error: "No se pudo guardar el registro. Inténtalo de nuevo más tarde." });
  }
});

server.listen(port, host, () => {
  console.log(`House of Odds server listening on http://${host}:${port}`);
  console.log(`Signup records are stored in ${signupFile}`);
});
