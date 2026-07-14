/** Rechtstext-Typen, die über die eRecht24-API abrufbar sind. */
export type ERecht24DocumentType =
  | "imprint"
  | "privacyPolicy"
  | "privacyPolicySocialMedia";

/** Typen, die in einer Push-Benachrichtigung (`erecht24_type`) vorkommen können. */
export type ERecht24PushType = ERecht24DocumentType | "message" | "ping";

export const ERECHT24_DOCUMENT_TYPES: readonly ERecht24DocumentType[] = [
  "imprint",
  "privacyPolicy",
  "privacyPolicySocialMedia",
];

/** Antwort von GET /imprint, /privacyPolicy und /privacyPolicySocialMedia. */
export interface ERecht24LegalDocument {
  /** Fertig gerendertes HTML (deutsch). */
  html_de: string;
  /** Fertig gerendertes HTML (englisch). */
  html_en: string;
  created: string;
  modified: string;
  pushed: string;
  /** HTML-Warnhinweise von eRecht24 (z. B. unvollständige Angaben). */
  warnings: string;
  /** Nur bei privacyPolicy vorhanden. */
  dsgalt?: boolean;
}

/** Antwort von GET /message (204 = keine Nachricht → null im Client). */
export interface ERecht24Message {
  message: string;
  message_de: string;
  call2action: string;
  call2action_de: string;
  link: string;
}

/** Ein bei eRecht24 registrierter Push-Client. */
export interface ERecht24RegisteredClient {
  client_id: number;
  project_id?: number;
  push_method?: "GET" | "POST";
  push_uri?: string;
  cms?: string;
  cms_version?: string;
  plugin_name?: string;
  author_mail?: string;
  created_at?: string;
  updated_at?: string;
}

/** Body für POST /clients bzw. PUT /clients/{id}. */
export interface ERecht24ClientRegistration {
  push_method: "GET" | "POST";
  push_uri: string;
  cms?: string;
  cms_version?: string;
  plugin_name?: string;
  author_mail?: string;
}

/** Antwort von POST /clients. */
export interface ERecht24ClientRegistrationResult {
  /** Muss gespeichert werden (ERECHT24_PUSH_SECRET) — wird bei jedem Push mitgesendet. */
  secret: string;
  client_id?: number;
}

/** Payload, den eRecht24 an die registrierte push_uri sendet. */
export interface ERecht24PushPayload {
  erecht24_secret: string;
  erecht24_type: ERecht24PushType;
}
