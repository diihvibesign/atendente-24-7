"use client";
import { useState, type FormEvent } from "react";
import type { TeamUser } from "@atendente/contracts";
import { useResource } from "../../../lib/resource";
import { useSession } from "../../../components/session";
import {
  PageHeader,
  Button,
  ErrorNotice,
  Loading,
} from "../../../components/ui";
import { InviteLink } from "../../../components/invite-link";
import { api, errorMessage } from "../../../lib/api";
export default function Team() {
  const { data, error, loading, reload } = useResource<TeamUser[]>("/team");
  const { session } = useSession();
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFailure("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const result = await api<{ activationUrl: string }>(
        "/team/invites",
        {
          method: "POST",
          body: JSON.stringify({
            name: values.get("name"),
            email: values.get("email"),
          }),
        },
        session!.csrfToken,
      );
      setLink(result.activationUrl);
      setMessage("Convite criado. Entregue o link por canal seguro.");
      form.reset();
      reload();
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    setFailure("");
    try {
      await api(`/team/${id}`, { method: "DELETE" }, session!.csrfToken);
      setMessage("Acesso revogado. As sessões desta pessoa foram encerradas.");
      setConfirm(null);
      reload();
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Equipe e acessos"
        description="Convide quem acompanha os atendimentos da sua funerária."
      />
      {failure && <ErrorNotice message={failure} />}
      <p role="status" className="success">
        {message}
      </p>
      <section className="panel content-panel">
        <h2>Convidar pessoa</h2>
        <p>Todos os membros recebem o mesmo acesso à sua funerária.</p>
        <form className="form-grid" onSubmit={invite}>
          <div>
            <label htmlFor="member-name">Nome</label>
            <input
              id="member-name"
              name="name"
              required
              minLength={2}
              maxLength={120}
            />
          </div>
          <div>
            <label htmlFor="member-email">E-mail</label>
            <input
              id="member-email"
              name="email"
              type="email"
              required
              maxLength={254}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Criando convite…" : "Gerar convite"}
          </Button>
        </form>
        {link && <InviteLink url={link} />}
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>Pessoas da equipe</h2>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorNotice message={error} retry={reload} />
        ) : (
          <ul className="team-list">
            {data?.map((member) => (
              <li key={member.id}>
                <div>
                  <strong>{member.name}</strong>
                  <span>{member.email}</span>
                </div>
                <span className="badge neutral">
                  {!member.active
                    ? "Revogado"
                    : member.activated
                      ? "Ativo"
                      : "Aguardando ativação"}
                </span>
                {member.id === session?.user.id ? (
                  <span className="muted">Você</span>
                ) : (
                  member.active &&
                  (confirm === member.id ? (
                    <div className="confirm-inline">
                      <p>Revogar o acesso de {member.name}?</p>
                      <Button disabled={busy} onClick={() => revoke(member.id)}>
                        Confirmar revogação
                      </Button>
                      <Button
                        className="secondary"
                        onClick={() => setConfirm(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="secondary"
                      disabled={busy}
                      onClick={() => setConfirm(member.id)}
                      aria-label={`Revogar acesso de ${member.name}`}
                    >
                      Revogar acesso
                    </Button>
                  ))
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
