"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { CaseDetail } from "@atendente/contracts";
import { useResource } from "../../../../lib/resource";
import { useSession } from "../../../../components/session";
import {
  PageHeader,
  Button,
  Loading,
  ErrorNotice,
  CaseStatus,
  fieldText,
  formatDate,
} from "../../../../components/ui";
import { api, errorMessage } from "../../../../lib/api";
const notification = {
  not_sent: "Não enviado",
  queued: "Na fila",
  sent: "Aceito pelo provedor",
  delivered: "Entrega confirmada",
  failed: "Falha no envio",
};
const transfer = {
  not_requested: "Não solicitada",
  pending: "Em tentativa",
  connected: "Conexão confirmada",
  failed: "Conexão não concluída",
};
export default function Detail() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useResource<CaseDetail>(
    `/cases/${id}`,
  );
  const { session } = useSession();
  const [failure, setFailure] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFailure("");
    setSuccess("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      await api(
        `/cases/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: values.get("status"),
            ...(values.get("note") ? { note: values.get("note") } : {}),
          }),
        },
        session!.csrfToken,
      );
      form.reset();
      setSuccess("Atendimento atualizado.");
      reload();
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (error) return <ErrorNotice message={error} retry={reload} />;
  if (!data) return null;
  return (
    <>
      <Link className="back-link" href="/app">
        Voltar aos atendimentos
      </Link>
      <PageHeader
        title={fieldText(data.caller)}
        description={`Recebido em ${formatDate(data.createdAt)}`}
        action={<CaseStatus status={data.status} />}
      />
      {data.source === "synthetic" && (
        <div className="notice">Atendimento sintético de demonstração.</div>
      )}
      <div className="detail-grid">
        <section className="panel content-panel">
          <h2>Informações compartilhadas</h2>
          <dl className="information">
            {[
              ["Contato para retorno", data.callbackPhone],
              ["Pessoa falecida", data.deceased],
              ["Local informado", data.location],
              ["Necessidade declarada", data.need],
            ].map(([label, field]) => (
              <div key={String(label)}>
                <dt>{String(label)}</dt>
                <dd>{fieldText(field as CaseDetail["caller"])}</dd>
              </div>
            ))}
          </dl>
          <div className="dispatch-status">
            <h3>Encaminhamento</h3>
            <p>
              Transferência: <strong>{transfer[data.transferStatus]}</strong>
            </p>
            <p>
              Alerta: <strong>{notification[data.notificationStatus]}</strong>
            </p>
            <small>
              Configuração{" "}
              {data.configurationVersion
                ? `v${data.configurationVersion}`
                : "ainda não vinculada"}
            </small>
          </div>
        </section>
        <section className="panel content-panel">
          <h2>Continuidade humana</h2>
          {failure && <ErrorNotice message={failure} />}
          <p role="status" className="success">
            {success}
          </p>
          <form onSubmit={save}>
            <label htmlFor="case-status">Status do atendimento</label>
            <select
              id="case-status"
              name="status"
              defaultValue={data.status}
              key={data.updatedAt}
            >
              <option value="open">Aguardando retorno</option>
              <option value="contacted">Contato realizado</option>
              <option value="closed">Encerrado</option>
            </select>
            <label htmlFor="note">
              Nota operacional <span className="muted">(opcional)</span>
            </label>
            <textarea
              id="note"
              name="note"
              maxLength={2000}
              rows={4}
              aria-describedby="note-help"
            />
            <small id="note-help">
              Registre o próximo passo. Evite detalhes íntimos ou clínicos
              desnecessários.
            </small>
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando…" : "Salvar atendimento"}
            </Button>
          </form>
          <h3 className="notes-heading">Notas da equipe</h3>
          {data.notes.length ? (
            <ul className="notes">
              {data.notes.map((note) => (
                <li key={note.id}>
                  <time dateTime={note.createdAt}>
                    {formatDate(note.createdAt)}
                  </time>
                  <p>{note.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nenhuma nota registrada.</p>
          )}
        </section>
      </div>
    </>
  );
}
