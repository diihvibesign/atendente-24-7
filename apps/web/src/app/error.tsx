"use client";
import { ErrorNotice } from "../components/ui";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <ErrorNotice
        message="Não foi possível abrir esta página."
        retry={reset}
      />
    </main>
  );
}
