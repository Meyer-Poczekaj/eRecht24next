import { ERecht24Document } from "@meyerpoczekaj/erecht24next/react";

export default function DatenschutzPage() {
  return (
    <main>
      <ERecht24Document
        type="privacyPolicy"
        lang="de"
        fallback={<p>Datenschutzerklärung derzeit nicht verfügbar.</p>}
      />
    </main>
  );
}
