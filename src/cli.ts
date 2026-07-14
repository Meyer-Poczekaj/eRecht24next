#!/usr/bin/env node
import { parseArgs } from "node:util";
import { ERecht24Api, ERecht24ApiError } from "./client.js";
import { ERecht24ConfigError } from "./config.js";
import type { ERecht24DocumentType, ERecht24PushType } from "./types.js";
import { ERECHT24_DOCUMENT_TYPES } from "./types.js";

const HELP = `erecht24next — eRecht24 Rechtstexte-Sync für Next.js

Benötigte Umgebungsvariable:
  ERECHT24_API_KEY      Projekt-API-Key aus dem eRecht24 Projekt Manager

Befehle:
  register --push-uri <url> [Optionen]   Client für Push-Benachrichtigungen registrieren
      --method <GET|POST>       Push-Methode (Default: POST)
      --cms <name>              CMS-Name (Default: Next.js)
      --cms-version <version>   CMS-Version
      --plugin-name <name>      Plugin-Name (Default: erecht24next)
      --author-mail <mail>      Kontakt-Mail für Rückfragen von eRecht24
  clients                                Registrierte Clients auflisten
  update <client_id> --push-uri <url> [Optionen wie bei register]
  unregister <client_id>                 Client löschen
  test-push <client_id> [--type <typ>]   Test-Push senden (Default: ping)
  pull [typ]                             Rechtstext(e) abrufen und Status anzeigen
                                         (typ: imprint | privacyPolicy | privacyPolicySocialMedia)
  help                                   Diese Hilfe anzeigen
`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function preview(html: string, length = 200): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      "push-uri": { type: "string" },
      method: { type: "string" },
      cms: { type: "string" },
      "cms-version": { type: "string" },
      "plugin-name": { type: "string" },
      "author-mail": { type: "string" },
      type: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  const command = positionals[0];
  if (!command || command === "help" || values.help) {
    console.log(HELP);
    return;
  }

  const api = new ERecht24Api();

  const registrationFromFlags = () => {
    const pushUri = values["push-uri"];
    if (!pushUri) fail("Fehlend: --push-uri <url> (z. B. https://example.de/api/erecht24)");
    const method = (values.method ?? "POST").toUpperCase();
    if (method !== "GET" && method !== "POST") {
      fail("--method muss GET oder POST sein.");
    }
    // Leere optionale Felder weglassen — die API lehnt "" ab
    // (author_mail muss, wenn gesendet, eine gültige Mail sein).
    return {
      push_method: method as "GET" | "POST",
      push_uri: pushUri,
      cms: values.cms ?? "Next.js",
      ...(values["cms-version"] ? { cms_version: values["cms-version"] } : {}),
      plugin_name: values["plugin-name"] ?? "erecht24next",
      ...(values["author-mail"] ? { author_mail: values["author-mail"] } : {}),
    };
  };

  const clientIdArg = (): number => {
    const raw = positionals[1];
    const id = raw ? Number.parseInt(raw, 10) : Number.NaN;
    if (!Number.isFinite(id)) fail(`Fehlend oder ungültig: <client_id>`);
    return id;
  };

  switch (command) {
    case "register": {
      const registration = registrationFromFlags();
      const result = await api.registerClient(registration);
      console.log("Client registriert.");
      if (result.client_id !== undefined) {
        console.log(`  client_id: ${result.client_id}`);
      }
      console.log(`  secret:    ${result.secret}`);
      console.log(
        "\nDas Secret jetzt in der Deployment-Umgebung setzen:\n" +
          `  ERECHT24_PUSH_SECRET=${result.secret}\n` +
          "\nEs wird nur einmal angezeigt und kann nicht erneut abgerufen werden.",
      );
      break;
    }

    case "clients": {
      const clients = await api.listClients();
      if (clients.length === 0) {
        console.log("Keine Clients registriert.");
        break;
      }
      for (const client of clients) {
        console.log(
          `#${client.client_id}  ${client.push_method ?? "?"} ${client.push_uri ?? "?"}` +
            `  (${client.plugin_name ?? "?"}, angelegt ${client.created_at ?? "?"})`,
        );
      }
      break;
    }

    case "update": {
      const clientId = clientIdArg();
      await api.updateClient(clientId, registrationFromFlags());
      console.log(`Client #${clientId} aktualisiert.`);
      break;
    }

    case "unregister": {
      const clientId = clientIdArg();
      await api.deleteClient(clientId);
      console.log(`Client #${clientId} gelöscht.`);
      break;
    }

    case "test-push": {
      const clientId = clientIdArg();
      const type = (values.type ?? "ping") as ERecht24PushType;
      await api.sendTestPush(clientId, type);
      console.log(
        `Test-Push (${type}) an Client #${clientId} gesendet und vom Client mit HTTP 200 beantwortet.`,
      );
      break;
    }

    case "pull": {
      const requested = positionals[1] as ERecht24DocumentType | undefined;
      const types = requested ? [requested] : [...ERECHT24_DOCUMENT_TYPES];
      for (const type of types) {
        if (!ERECHT24_DOCUMENT_TYPES.includes(type)) {
          fail(
            `Unbekannter Typ: ${type} (erlaubt: ${ERECHT24_DOCUMENT_TYPES.join(", ")})`,
          );
        }
        try {
          const doc = await api.getDocument(type, { cache: "no-store" });
          console.log(`${type}`);
          console.log(`  geändert: ${doc.modified}`);
          console.log(`  de: ${preview(doc.html_de)}`);
          if (doc.warnings) console.log(`  Warnungen: ${preview(doc.warnings)}`);
        } catch (error) {
          if (error instanceof ERecht24ApiError && error.status === 404) {
            console.log(`${type}\n  kein Text mit diesem API-Key verknüpft (404)`);
          } else {
            throw error;
          }
        }
      }
      break;
    }

    default:
      fail(`Unbekannter Befehl: ${command}\n\n${HELP}`);
  }
}

main().catch((error: unknown) => {
  if (error instanceof ERecht24ConfigError || error instanceof ERecht24ApiError) {
    fail(error.message);
  }
  throw error;
});
