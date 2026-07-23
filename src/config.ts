/**
 * eRecht24-Demo-Keys aus der offiziellen API-Dokumentation
 * (https://api-docs.e-recht24.de/). Nur für die Entwicklung gedacht —
 * sie liefern Beispieltexte ("Max Mustermann").
 */
export const ERECHT24_DEMO_API_KEY =
  "e81cbf18a5239377aa4972773d34cc2b81ebc672879581bce29a0a4c414bf117";
export const ERECHT24_DEMO_PLUGIN_KEY =
  "3jh4uhn8u69i97kj9timk466748996ikhkjhlk67plli08lhkijgh8z4363gr53v";

/**
 * Fest im Package hinterlegter, produktiver eRecht24 Developer-/Plugin-Key.
 * Er identifiziert dieses Plugin gegenüber der eRecht24-API — Endnutzer des
 * Packages müssen (und sollen) hier nichts konfigurieren.
 */
export const ERECHT24_PLUGIN_KEY =
  "srgFbgMcUZdRsUYZ5XwCR5ad5oNaAaxn35DAdNWFRPvLWoLCKMeWiPaQ2dicRwYz";

export const ERECHT24_DEFAULT_BASE_URL = "https://api.e-recht24.de/v2";

/** Standard-Cache-Lebensdauer als Sicherheitsnetz, falls ein Push verloren geht. */
export const ERECHT24_DEFAULT_REVALIDATE = 86400;

export interface ERecht24Config {
  /** Projekt-API-Key aus dem eRecht24 Projekt Manager (`ERECHT24_API_KEY`). */
  apiKey: string;
  /**
   * Developer-/Plugin-Key. Fest im Package hinterlegt
   * (ERECHT24_PLUGIN_KEY-Konstante); Override nur für Tests gedacht.
   */
  pluginKey: string;
  /** Secret aus der Client-Registrierung (`ERECHT24_PUSH_SECRET`). */
  pushSecret?: string;
  /** API-Basis-URL, überschreibbar für Tests (`ERECHT24_BASE_URL`). */
  baseUrl: string;
  /** Cache-Lebensdauer der Rechtstexte in Sekunden (`ERECHT24_REVALIDATE`). */
  revalidate: number;
}

export class ERecht24ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ERecht24ConfigError";
  }
}

let warnedAboutDemoKeys = false;

/**
 * Baut die Konfiguration aus Umgebungsvariablen zusammen; explizite Overrides
 * gewinnen. Wirft eine ERecht24ConfigError, wenn kein API-Key gesetzt ist.
 */
export function resolveConfig(
  overrides: Partial<ERecht24Config> = {},
): ERecht24Config {
  const env = process.env;
  const apiKey = overrides.apiKey ?? env.ERECHT24_API_KEY;
  if (!apiKey) {
    throw new ERecht24ConfigError(
      "eRecht24: Kein API-Key gefunden. Setze die Umgebungsvariable " +
        "ERECHT24_API_KEY (Key im eRecht24 Projekt Manager erstellen: " +
        "https://www.e-recht24.de/mitglieder/tools/projekt-manager/).",
    );
  }

  const pluginKey = overrides.pluginKey ?? ERECHT24_PLUGIN_KEY;

  if (
    !warnedAboutDemoKeys &&
    process.env.NODE_ENV === "production" &&
    apiKey === ERECHT24_DEMO_API_KEY
  ) {
    warnedAboutDemoKeys = true;
    console.warn(
      "eRecht24: Es wird der Demo-API-Key verwendet — die API liefert nur " +
        "Beispieltexte. Für den Produktivbetrieb ERECHT24_API_KEY setzen.",
    );
  }

  const revalidateRaw = overrides.revalidate ?? env.ERECHT24_REVALIDATE;
  const revalidate =
    typeof revalidateRaw === "number"
      ? revalidateRaw
      : revalidateRaw
        ? Number.parseInt(revalidateRaw, 10)
        : ERECHT24_DEFAULT_REVALIDATE;
  if (!Number.isFinite(revalidate) || revalidate <= 0) {
    throw new ERecht24ConfigError(
      "eRecht24: ERECHT24_REVALIDATE muss eine positive Zahl (Sekunden) sein.",
    );
  }

  return {
    apiKey,
    pluginKey,
    pushSecret: overrides.pushSecret ?? env.ERECHT24_PUSH_SECRET,
    baseUrl: (
      overrides.baseUrl ??
      env.ERECHT24_BASE_URL ??
      ERECHT24_DEFAULT_BASE_URL
    ).replace(/\/$/, ""),
    revalidate,
  };
}
