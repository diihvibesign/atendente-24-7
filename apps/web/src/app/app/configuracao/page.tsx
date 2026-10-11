"use client";
import { useState, type FormEvent } from "react";
import { defaultRouting, type Settings } from "@atendente/contracts";
import { useResource } from "../../../lib/resource";
import { useSession } from "../../../components/session";
import {
  PageHeader,
  Button,
  Loading,
  ErrorNotice,
} from "../../../components/ui";
import { RoutingForm } from "../../../components/routing-form";
import { api, errorMessage } from "../../../lib/api";
export default function Configuration() {
  const { data, error, loading, reload } =
    useResource<Settings>("/tenant/settings");
  const { session } = useSession();
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  async function contact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFailure("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      await api(
        "/tenant/contacts",
        {
          method: "POST",
          body: JSON.stringify({
            name: values.get("name"),
            phone: values.get("phone"),
          }),
        },
        session!.csrfToken,
      );
      form.reset();
      setMessage(
        "Contato adicionado. A verificação por SMS precisa ser conectada antes da publicação.",
      );
      reload();
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    setFailure("");
    try {
      await api(
        "/tenant/settings/publish",
        {
          method: "POST",
          body: JSON.stringify({ version: data!.latest!.version }),
        },
        session!.csrfToken,
      );
      setMessage(
        "Configuração publicada. A telefonia permanece pendente dos testes de ativação.",
      );
      reload();
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (error) return <ErrorNotice message={error} retry={reload} />;
  if (!data || !session) return null;
  const verified = data.contacts.some(
    (c) => c.id === data.latest?.configuration.contactId && c.verified,
  );
  return (
    <>
      <PageHeader
        title="Atendimento e plantão"
        description="Prepare a saudação, os horários e o caminho até sua equipe."
      />
      <div className="publication-bar">
        <div>
          <strong>
            {data.publishedVersion
              ? `Publicada v${data.publishedVersion}`
              : "Nenhuma versão publicada"}
          </strong>
          <p>
            {data.latest
              ? `Última versão salva: v${data.latest.version}`
              : "Salve sua primeira configuração."}
          </p>
        </div>
        <Button
          className="secondary"
          disabled={
            busy ||
            !data.latest ||
            !verified ||
            data.publishedVersion === data.latest.version
          }
          onClick={publish}
        >
          Publicar versão salva
        </Button>
      </div>
      {!verified && (
        <div className="notice">
          A publicação exige contato verificado. A conexão para verificação por
          SMS está pendente.
        </div>
      )}
      {failure && <ErrorNotice message={failure} />}
      <p className="success" role="status">
        {message}
      </p>
      <RoutingForm
        key={`${data.latest?.version ?? 0}:${data.contacts.length}`}
        initial={
          data.latest?.configuration ??
          defaultRouting(session.user.tenantName ?? "Sua funerária")
        }
        version={data.latest?.version ?? 0}
        contacts={data.contacts}
        csrfToken={session.csrfToken}
        onSaved={(version) => {
          setMessage(`Versão v${version} salva como rascunho.`);
          reload();
        }}
      />
      <section className="panel content-panel contacts-panel">
        <h2>Contatos de plantão</h2>
        <p>
          Adicionar um contato não envia mensagens. A verificação será conectada
          na próxima fase.
        </p>
        <ul className="contacts">
          {data.contacts.map((c) => (
            <li key={c.id}>
              <strong>{c.name}</strong>
              <span>{c.phone}</span>
              <span className={`badge ${c.verified ? "green" : "amber"}`}>
                {c.verified ? "Verificado" : "Pendente"}
              </span>
            </li>
          ))}
        </ul>
        <form className="form-grid" onSubmit={contact}>
          <div>
            <label htmlFor="oncall-name">Nome do contato</label>
            <input
              id="oncall-name"
              name="name"
              required
              minLength={2}
              maxLength={120}
            />
          </div>
          <div>
            <label htmlFor="oncall-phone">Celular com código do país</label>
            <input
              id="oncall-phone"
              name="phone"
              type="tel"
              placeholder="+5511999999999"
              pattern="\+55[0-9]{10,11}"
              required
              maxLength={14}
              aria-describedby="phone-help"
            />
            <small id="phone-help">
              Formato internacional: +55, DDD e número.
            </small>
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Adicionando…" : "Adicionar contato"}
          </Button>
        </form>
      </section>
    </>
  );
}
