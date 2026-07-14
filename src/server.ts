import { ERecht24Api, ERecht24ApiError } from "./client.js";
import type { ERecht24Config } from "./config.js";
import type {
  ERecht24DocumentType,
  ERecht24LegalDocument,
  ERecht24Message,
} from "./types.js";

/**
 * Next.js-Integration: gecachte Getter für die Rechtstexte.
 *
 * Die Texte landen mit einem Cache-Tag im Next-Data-Cache und bleiben dort,
 * bis entweder der Push-Webhook (`erecht24next/handler`) sie invalidiert oder
 * die revalidate-Frist (Default: 24 h) als Sicherheitsnetz abläuft.
 */

export interface ERecht24ServerOptions {
  /** Config-Overrides; Default kommt aus den Umgebungsvariablen. */
  config?: Partial<ERecht24Config>;
}

/** Cache-Tag, mit dem ein Rechtstext im Next-Data-Cache abgelegt wird. */
export function erecht24Tag(type: ERecht24DocumentType | "message"): string {
  return `erecht24:${type}`;
}

/** Rechtstext gecacht abrufen. Wirft bei API-/Konfigurationsfehlern. */
export async function getLegalDocument(
  type: ERecht24DocumentType,
  options: ERecht24ServerOptions = {},
): Promise<ERecht24LegalDocument> {
  const api = new ERecht24Api(options.config);
  return api.getDocument(type, {
    cache: "force-cache",
    next: { tags: [erecht24Tag(type)], revalidate: api.config.revalidate },
  });
}

/**
 * Wie getLegalDocument, aber fehlertolerant: liefert null, wenn der Text
 * nicht abrufbar ist (kein Text verknüpft, API down, fehlende Konfiguration).
 * Gedacht für Seiten, die dann auf lokalen Inhalt zurückfallen.
 */
export async function getLegalDocumentSafe(
  type: ERecht24DocumentType,
  options: ERecht24ServerOptions = {},
): Promise<ERecht24LegalDocument | null> {
  try {
    return await getLegalDocument(type, options);
  } catch (error) {
    if (error instanceof ERecht24ApiError && error.status === 404) {
      // Kein Rechtstext mit diesem API-Key verknüpft — erwartbarer Zustand.
      return null;
    }
    console.error(`eRecht24: ${type} konnte nicht geladen werden.`, error);
    return null;
  }
}

export function getImprint(options?: ERecht24ServerOptions) {
  return getLegalDocument("imprint", options);
}

export function getPrivacyPolicy(options?: ERecht24ServerOptions) {
  return getLegalDocument("privacyPolicy", options);
}

export function getPrivacyPolicySocialMedia(options?: ERecht24ServerOptions) {
  return getLegalDocument("privacyPolicySocialMedia", options);
}

/** Aktuelle eRecht24-Nachricht (ungecacht); null wenn keine vorliegt. */
export async function getMessage(
  options: ERecht24ServerOptions = {},
): Promise<ERecht24Message | null> {
  const api = new ERecht24Api(options.config);
  return api.getMessage();
}
