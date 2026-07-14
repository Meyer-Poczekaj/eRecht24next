import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>erecht24next Beispiel</h1>
      <ul>
        <li>
          <Link href="/impressum">Impressum (eRecht24-Sync)</Link>
        </li>
        <li>
          <Link href="/datenschutz">Datenschutzerklärung (eRecht24-Sync)</Link>
        </li>
      </ul>
    </main>
  );
}
