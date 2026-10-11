"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PhoneIncoming, ShieldCheck } from "lucide-react";
import type { Session } from "@atendente/contracts";
import { useSession } from "../../components/session";
import { Brand, Button, ErrorNotice } from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
export default function Login() {
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { setSession } = useSession();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const result = await api<Session>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
          ...(data.get("otp") ? { otp: data.get("otp") } : {}),
        }),
      });
      setSession(result);
      router.replace(result.user.role === "admin" ? "/admin" : "/app");
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <Brand />
        <div className="login-copy">
          <span className="call-symbol">
            <PhoneIncoming size={36} aria-hidden="true" />
          </span>
          <h1>
            O cuidado continua
            <br />
            depois da ligação.
          </h1>
          <p>
            Organize os pedidos de atendimento e prepare sua equipe para acolher
            cada família.
          </p>
        </div>
        <p className="login-footnote">
          Atendimento digital. Continuidade humana.
        </p>
      </section>
      <section className="login-form">
        <div className="form-wrap">
          <h2>Entrar na plataforma</h2>
          <p>Acesse com a conta da sua funerária ou da administração.</p>
          {failure && <ErrorNotice message={failure} />}
          <form onSubmit={submit}>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              enterKeyHint="next"
              required
              maxLength={254}
            />
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              enterKeyHint="next"
              required
              maxLength={128}
            />
            <label htmlFor="otp">
              Código do autenticador{" "}
              <span className="muted">(somente admin)</span>
            </label>
            <input
              id="otp"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              enterKeyHint="done"
              pattern="[0-9]{6}"
              maxLength={6}
              aria-describedby="otp-help"
            />
            <small id="otp-help">
              Administradores precisam informar o código de 6 dígitos do MFA.
            </small>
            <Button type="submit" disabled={busy}>
              {busy ? "Entrando…" : "Entrar"}
            </Button>
          </form>
          <details>
            <summary>Preciso recuperar meu acesso</summary>
            <p>
              Solicite um link de recuperação à administração da plataforma. O
              link é temporário e de uso único.
            </p>
          </details>
          <div className="privacy-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Os atendimentos ficam restritos à sua funerária.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
