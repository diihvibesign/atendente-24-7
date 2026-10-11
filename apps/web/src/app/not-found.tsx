import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone">
      <h1>Página não encontrada</h1>
      <p>O endereço pode ter mudado.</p>
      <Link href="/app" className="button">
        Voltar ao painel
      </Link>
    </main>
  );
}
