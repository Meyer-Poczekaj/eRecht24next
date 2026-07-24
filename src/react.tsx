import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { getLegalDocumentSafe, type ERecht24ServerOptions } from "./server.js";
import type { ERecht24DocumentType } from "./types.js";

export interface ERecht24DocumentProps
  extends Omit<
    ComponentPropsWithoutRef<"div">,
    "children" | "dangerouslySetInnerHTML"
  > {
  /** Welcher Rechtstext gerendert wird. */
  type: ERecht24DocumentType;
  /** Sprachfassung; Default "de". */
  lang?: "de" | "en";
  /**
   * Wird gerendert, wenn der Text nicht abrufbar ist (kein Text verknüpft,
   * API nicht erreichbar, Konfiguration fehlt) — z. B. eine lokale Kopie.
   */
  fallback?: ReactNode;
  /** Config-Overrides, siehe @meyerpoczekaj/erecht24next/server. */
  erecht24?: ERecht24ServerOptions;
}

/**
 * Async Server Component: rendert einen eRecht24-Rechtstext als HTML.
 *
 * ```tsx
 * import { ERecht24Document } from "@meyerpoczekaj/erecht24next/react";
 *
 * export default function DatenschutzPage() {
 *   return <ERecht24Document type="privacyPolicy" lang="de" className="prose" />;
 * }
 * ```
 *
 * Das HTML stammt unverändert von der authentifizierten eRecht24-API
 * (gleiches Vertrauensmodell wie die offiziellen eRecht24-Plugins).
 */
export async function ERecht24Document({
  type,
  lang = "de",
  fallback = null,
  erecht24,
  ...divProps
}: ERecht24DocumentProps): Promise<ReactNode> {
  const doc = await getLegalDocumentSafe(type, erecht24);
  const html = lang === "de" ? doc?.html_de : doc?.html_en;
  if (!html) return fallback;
  return <div {...divProps} dangerouslySetInnerHTML={{ __html: html }} />;
}
