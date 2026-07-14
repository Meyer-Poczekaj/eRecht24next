import { revalidateTag } from "next/cache";
import { ERecht24Api } from "./client.js";
import { resolveConfig, type ERecht24Config } from "./config.js";
import { erecht24Tag } from "./server.js";
import type {
  ERecht24DocumentType,
  ERecht24Message,
  ERecht24PushType,
} from "./types.js";
import { ERECHT24_DOCUMENT_TYPES } from "./types.js";

/**
 * Push-Webhook für eRecht24. Einbindung in der Next-App:
 *
 * ```ts
 * // app/api/erecht24/route.ts
 * import { createERecht24Handler } from "erecht24next/handler";
 * export const { GET, POST } = createERecht24Handler();
 * ```
 *
 * eRecht24 ruft die registrierte push_uri mit
 * `{ erecht24_secret, erecht24_type }` auf (als Query-Parameter bei GET,
 * als Body bei POST). Der Handler prüft das Secret, beantwortet `ping` mit
 * `pong`, invalidiert bei Rechtstext-Typen den Cache-Tag und zieht den Text
 * sofort frisch von der API (wie es die eRecht24-Doku verlangt).
 */

export interface ERecht24HandlerOptions {
  /** Config-Overrides; Default kommt aus den Umgebungsvariablen. */
  config?: Partial<ERecht24Config>;
  /**
   * Rechtstext-Typen, die bewusst lokal gepflegt werden. Pushes dafür werden
   * laut API-Doku mit HTTP 422 beantwortet.
   */
  managedLocally?: ERecht24DocumentType[];
  /** Hook nach erfolgreich verarbeitetem Rechtstext-Push. */
  onDocumentUpdated?: (
    type: ERecht24DocumentType,
  ) => void | Promise<void>;
  /** Hook für eingehende eRecht24-Nachrichten (z. B. E-Mail an Admin). */
  onMessage?: (message: ERecht24Message | null) => void | Promise<void>;
}

const PUSH_TYPES: readonly ERecht24PushType[] = [
  ...ERECHT24_DOCUMENT_TYPES,
  "message",
  "ping",
];

function json(status: number, body: unknown): Response {
  return Response.json(body, { status });
}

/** Konstantzeit-Vergleich ohne node:crypto (läuft auch in Edge-Runtimes). */
function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bytesA = encoder.encode(a);
  const bytesB = encoder.encode(b);
  if (bytesA.length !== bytesB.length) return false;
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) diff |= bytesA[i] ^ bytesB[i];
  return diff === 0;
}

async function extractPayload(
  request: Request,
): Promise<{ secret: string; type: string }> {
  const url = new URL(request.url);
  let secret = url.searchParams.get("erecht24_secret") ?? "";
  let type = url.searchParams.get("erecht24_type") ?? "";

  if (request.method === "POST" && (!secret || !type)) {
    const contentType = request.headers.get("content-type") ?? "";
    try {
      if (contentType.includes("application/json")) {
        const body = (await request.json()) as Record<string, unknown>;
        secret ||= String(body.erecht24_secret ?? "");
        type ||= String(body.erecht24_type ?? "");
      } else if (
        contentType.includes("application/x-www-form-urlencoded") ||
        contentType.includes("multipart/form-data")
      ) {
        const form = await request.formData();
        secret ||= String(form.get("erecht24_secret") ?? "");
        type ||= String(form.get("erecht24_type") ?? "");
      }
    } catch {
      // Unlesbarer Body → wird unten als fehlende Parameter behandelt.
    }
  }

  return { secret, type };
}

export function createERecht24Handler(options: ERecht24HandlerOptions = {}) {
  async function handle(request: Request): Promise<Response> {
    let config: ERecht24Config;
    try {
      config = resolveConfig(options.config);
    } catch (error) {
      console.error("eRecht24: Push-Endpunkt nicht konfiguriert.", error);
      return json(503, { message: "eRecht24 client is not configured." });
    }

    if (!config.pushSecret) {
      console.error(
        "eRecht24: ERECHT24_PUSH_SECRET fehlt. Erst den Client registrieren " +
          "(npx erecht24next register) und das Secret als Umgebungsvariable setzen.",
      );
      return json(503, { message: "Push secret is not configured." });
    }

    const { secret, type } = await extractPayload(request);

    if (!secret || !safeEqual(secret, config.pushSecret)) {
      return json(401, { message: "Invalid erecht24_secret." });
    }

    if (!PUSH_TYPES.includes(type as ERecht24PushType)) {
      return json(400, { message: `Unknown erecht24_type: ${type}` });
    }

    if (type === "ping") {
      return json(200, { message: "pong" });
    }

    const api = new ERecht24Api(options.config);

    if (type === "message") {
      try {
        const message = await api.getMessage();
        await options.onMessage?.(message);
        return json(200, { message: "Message pulled." });
      } catch (error) {
        console.error("eRecht24: Nachricht konnte nicht geladen werden.", error);
        return json(400, { message: "Failed to pull message." });
      }
    }

    const documentType = type as ERecht24DocumentType;

    if (options.managedLocally?.includes(documentType)) {
      return json(422, { message: `${documentType} is managed locally.` });
    }

    // Tag sofort verwerfen und den Text direkt neu in den Cache ziehen —
    // so ist der neue Stand live, bevor der nächste Besucher kommt.
    revalidateTag(erecht24Tag(documentType), { expire: 0 });
    try {
      await api.getDocument(documentType, {
        cache: "force-cache",
        next: {
          tags: [erecht24Tag(documentType)],
          revalidate: config.revalidate,
        },
      });
      await options.onDocumentUpdated?.(documentType);
      return json(200, { message: `${documentType} updated.` });
    } catch (error) {
      console.error(
        `eRecht24: ${documentType} konnte nach Push nicht geladen werden.`,
        error,
      );
      return json(400, { message: `Failed to pull ${documentType}.` });
    }
  }

  return { GET: handle, POST: handle };
}
