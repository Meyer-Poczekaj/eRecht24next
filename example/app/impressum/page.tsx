import { ERecht24Document } from "@meyerpoczekaj/erecht24next/react";

export default function ImpressumPage() {
  return (
    <main>
      <ERecht24Document
        type="imprint"
        lang="de"
        fallback={<p>Impressum derzeit nicht verfügbar.</p>}
      />
    </main>
  );
}
