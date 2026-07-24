import { resolveConfig, type ERecht24Config } from "./config.js";
import type {
  ERecht24ClientRegistration,
  ERecht24ClientRegistrationResult,
  ERecht24DocumentType,
  ERecht24LegalDocument,
  ERecht24Message,
  ERecht24PushType,
  ERecht24RegisteredClient,
} from "./types.js";

/**
 * RequestInit inklusive der Next.js-Cache-Erweiterung. Außerhalb von Next
 * (z. B. im CLI) wird `next` von fetch schlicht ignoriert.
 */
export type NextFetchRequestInit = RequestInit & {
  /** Fehlt in den Node-20-Typen, existiert aber zur Laufzeit (Web-Fetch). */
  cache?: "default" | "force-cache" | "no-cache" | "no-store" | "reload";
  next?: { tags?: string[]; revalidate?: number | false };
};

export class ERecht24ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ERecht24ApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Dünner, typisierter Client für die eRecht24-API v2.
 * Framework-frei — die Next.js-Integration liegt in `@meyerpoczekaj/erecht24next/server`.
 */
export class ERecht24Api {
  readonly config: ERecht24Config;

  constructor(config: Partial<ERecht24Config> = {}) {
    this.config = resolveConfig(config);
  }

  private async request<T>(
    path: string,
    init: NextFetchRequestInit = {},
  ): Promise<{ status: number; data: T }> {
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        "eRecht24-api-key": this.config.apiKey,
        "eRecht24-plugin-key": this.config.pluginKey,
        ...(init.body !== undefined
          ? { "content-type": "application/json" }
          : {}),
        ...init.headers,
      },
    });

    if (res.status === 204) {
      return { status: res.status, data: undefined as T };
    }

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }

    if (!res.ok) {
      const body =
        typeof data === "object" && data !== null
          ? (data as { message?: unknown; debug?: unknown })
          : {};
      let message =
        body.message !== undefined
          ? String(body.message)
          : `eRecht24 API: ${init.method ?? "GET"} ${path} fehlgeschlagen (HTTP ${res.status})`;
      if (body.debug !== undefined) {
        message += ` Details: ${JSON.stringify(body.debug)}`;
      }
      throw new ERecht24ApiError(message, res.status, data);
    }

    return { status: res.status, data: data as T };
  }

  /** Rechtstext abrufen (imprint | privacyPolicy | privacyPolicySocialMedia). */
  async getDocument(
    type: ERecht24DocumentType,
    init?: NextFetchRequestInit,
  ): Promise<ERecht24LegalDocument> {
    const { data } = await this.request<ERecht24LegalDocument>(
      `/${type}`,
      init,
    );
    return data;
  }

  /**
   * Nachricht von eRecht24 abrufen. Laut Doku nur nach einer entsprechenden
   * Push-Benachrichtigung aufrufen. 204 (keine Nachricht) → null.
   */
  async getMessage(
    init?: NextFetchRequestInit,
  ): Promise<ERecht24Message | null> {
    const { status, data } = await this.request<ERecht24Message>("/message", {
      cache: "no-store",
      ...init,
    });
    return status === 204 ? null : data;
  }

  /** Alle für diesen API-Key registrierten Push-Clients auflisten. */
  async listClients(): Promise<ERecht24RegisteredClient[]> {
    const { data } = await this.request<ERecht24RegisteredClient[]>(
      "/clients",
      { cache: "no-store" },
    );
    return data;
  }

  /**
   * Client für Push-Benachrichtigungen registrieren. Das zurückgegebene
   * `secret` muss dauerhaft gespeichert werden (ERECHT24_PUSH_SECRET).
   */
  async registerClient(
    registration: ERecht24ClientRegistration,
  ): Promise<ERecht24ClientRegistrationResult> {
    const { data } = await this.request<ERecht24ClientRegistrationResult>(
      "/clients",
      { method: "POST", body: JSON.stringify(registration) },
    );
    return data;
  }

  async updateClient(
    clientId: number,
    registration: ERecht24ClientRegistration,
  ): Promise<void> {
    await this.request(`/clients/${clientId}`, {
      method: "PUT",
      body: JSON.stringify(registration),
    });
  }

  async deleteClient(clientId: number): Promise<void> {
    await this.request(`/clients/${clientId}`, { method: "DELETE" });
  }

  /** Test-Push an einen registrierten Client auslösen (Entwicklung). */
  async sendTestPush(
    clientId: number,
    type: ERecht24PushType = "ping",
  ): Promise<void> {
    await this.request(
      `/clients/${clientId}/testPush?type=${encodeURIComponent(type)}`,
      { method: "POST" },
    );
  }
}
