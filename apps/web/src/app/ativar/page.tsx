"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Brand, Button, ErrorNotice } from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
export default function Activate() {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFailure("");
    const data = new FormData(event.currentTarget);
    try {
      if (data.get("password") !== data.get("confirmation"))
        throw new Error("As senhas precisam ser iguais.");
      const token = new URLSearchParams(window.location.hash.slice(1)).get(
        "token",
      );
      await api("/auth/activate", {
        method: "POST",
        body: JSON.stringify({ token, password: data.get("password") }),
      });
      window.history.replaceState(null, "", "/ativar");
      setDone(true);
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="standalone">
      <div className="activation panel">
        <Brand />
        <h1>{done ? "Acesso preparado" : "Defina sua senha"}</h1>
        {done ? (
          <>
            <p role="status">Sua senha foi salva. Entre para continuar.</p>
            <Link href="/login" className="button">
              Ir para o login
            </Link>
          </>
        ) : (
          <>
            <p>
              Use pelo menos 12 caracteres. Este link só pode ser usado uma vez.
            </p>
            {failure && <ErrorNotice message={failure} />}
            <form onSubmit={submit}>
              <label htmlFor="new-password">Nova senha</label>
              <input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
              <label htmlFor="confirmation">Confirme a senha</label>
              <input
                id="confirmation"
                name="confirmation"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
              <Button type="submit" disabled={busy}>
                {busy ? "Salvando…" : "Salvar senha"}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
