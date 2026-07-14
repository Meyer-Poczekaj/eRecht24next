# eRecht24next

eRecht24 Rechtstexte für Next.js: automatische Synchronisation von Impressum,
Datenschutzerklärung und Social-Media-Datenschutzerklärung über die
[eRecht24 Rechtstexte-API](https://api-docs.e-recht24.de/) — inklusive
Push-Webhook, gecachten Server-Gettern und einer fertigen Server Component.

Ändert sich ein Rechtstext im
[eRecht24 Projekt Manager](https://www.e-recht24.de/mitglieder/tools/projekt-manager/),
benachrichtigt eRecht24 die Website per Push; der Webhook invalidiert den Cache
und zieht den neuen Text sofort — ohne Rebuild, ohne Deployment.

## Voraussetzungen

- Next.js ≥ 15 (App Router), Node ≥ 18
- Ein eRecht24-**API-Key** pro Website/Projekt (im Projekt Manager erstellen)

Der eRecht24-**Plugin-Key** (Developer-Key) ist fest im Package hinterlegt
und muss nicht konfiguriert werden.

## Installation

```bash
npm install erecht24next
```

## Einrichtung (3 Schritte pro Website)

### 1. Umgebungsvariable setzen

```bash
ERECHT24_API_KEY=<Key aus dem eRecht24 Projekt Manager>
```

### 2. Push-Webhook anlegen

```ts
// app/api/erecht24/route.ts
import { createERecht24Handler } from "erecht24next/handler";

export const { GET, POST } = createERecht24Handler();
```

Dann die Website einmalig als Push-Client registrieren:

```bash
npx erecht24next register --push-uri https://example.de/api/erecht24
```

Das ausgegebene Secret als `ERECHT24_PUSH_SECRET` in die
Deployment-Umgebung übernehmen. Fertig — eRecht24 pusht ab jetzt bei jeder
Textänderung.

### 3. Rechtstexte rendern

```tsx
// app/impressum/page.tsx
import { ERecht24Document } from "erecht24next/react";

export default function ImpressumPage() {
  return (
    <ERecht24Document
      type="imprint" // "imprint" | "privacyPolicy" | "privacyPolicySocialMedia"
      lang="de" // "de" | "en"
      className="prose"
      fallback={<LokalesImpressum />} // optional: wenn die API nicht liefert
    />
  );
}
```

Oder auf Daten-Ebene, wenn ihr das Markup selbst bauen wollt:

```tsx
import { getPrivacyPolicy, getLegalDocumentSafe } from "erecht24next/server";

const doc = await getPrivacyPolicy(); // wirft bei Fehlern
const safe = await getLegalDocumentSafe("privacyPolicy"); // null bei Fehlern
```

## Wie der Sync funktioniert

1. `getLegalDocument()` (bzw. `<ERecht24Document>`) lädt den Text über den
   Next-Data-Cache: getaggt mit `erecht24:<typ>`, Lebensdauer
   `ERECHT24_REVALIDATE` (Default 24 h) als Sicherheitsnetz.
2. Bei einer Textänderung ruft eRecht24 den Webhook mit
   `{ erecht24_secret, erecht24_type }` auf.
3. Der Handler prüft das Secret (konstantzeitiger Vergleich), verwirft den
   Cache-Tag (`revalidateTag(..., { expire: 0 })`) und zieht den neuen Text
   sofort in den Cache. `ping` wird mit `pong` beantwortet, unbekannte Typen
   mit HTTP 400 — wie es die eRecht24-Doku verlangt.

## CLI

```
npx erecht24next register --push-uri <url> [--method GET|POST] [--author-mail <mail>]
npx erecht24next clients                    # registrierte Clients auflisten
npx erecht24next update <client_id> --push-uri <url>
npx erecht24next unregister <client_id>
npx erecht24next test-push <client_id> [--type ping|imprint|privacyPolicy|...]
npx erecht24next pull [typ]                 # Texte abrufen, Status anzeigen
```

Das CLI liest dieselbe Umgebungsvariable (`ERECHT24_API_KEY`), auch aus der
Shell-Umgebung.

## Konfiguration

| Variable                | Pflicht | Beschreibung                                              |
| ----------------------- | ------- | --------------------------------------------------------- |
| `ERECHT24_API_KEY`      | ja      | Projekt-API-Key aus dem eRecht24 Projekt Manager          |
| `ERECHT24_PUSH_SECRET`  | für Push| Secret aus `npx erecht24next register`                    |
| `ERECHT24_REVALIDATE`   | nein    | Cache-Lebensdauer in Sekunden (Default `86400`)           |
| `ERECHT24_BASE_URL`     | nein    | API-Basis-URL (Default `https://api.e-recht24.de/v2`)     |

Der Plugin-Key ist bewusst **keine** Umgebungsvariable: Er identifiziert das
Plugin (nicht die Website) und ist fest im Package hinterlegt.

Alle Werte lassen sich pro Aufruf überschreiben
(`createERecht24Handler({ config: {...} })`,
`getLegalDocument(type, { config: {...} })`) — z. B. für Multi-Site-Setups
mit mehreren API-Keys in einer App.

`createERecht24Handler` akzeptiert außerdem:

- `managedLocally: ["imprint"]` — Pushes für lokal gepflegte Texte werden
  laut API-Konvention mit HTTP 422 beantwortet
- `onDocumentUpdated(type)` — Hook nach erfolgreichem Sync
- `onMessage(message)` — Hook für eRecht24-Nachrichten (z. B. Admin-Mail)

## Beispiel-App

Unter [`example/`](example/) liegt eine lauffähige Minimal-App
(läuft mit den Demo-Keys ohne weitere Einrichtung):

```bash
cd example && npm install && npm run dev
```

## Hinweise

- Das gelieferte HTML wird unverändert gerendert — gleiches Vertrauensmodell
  wie die offiziellen eRecht24-Plugins (die Quelle ist die authentifizierte
  eRecht24-API).
- `GET /message` wird nur nach entsprechender Push-Benachrichtigung
  abgerufen, wie von der API-Doku gefordert.
- API-Keys sind sha256-Hashes (64 Zeichen); das Push-Secret hat bis zu
  128 Zeichen.
