"use client";
import { useState, type FormEvent } from "react";
import type { Routing, Contact } from "@atendente/contracts";
import { Button, ErrorNotice } from "./ui";
import { api, errorMessage } from "../lib/api";
import { RoutingHours } from "./routing-hours";

export function RoutingForm({
  initial,
  version,
  contacts,
  csrfToken,
  onSaved,
}: {
  initial: Routing;
  version: number;
  contacts: Contact[];
  csrfToken: string;
  onSaved: (version: number) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  function update<K extends keyof Routing>(field: K, value: Routing[K]) {
    setDraft((previous) => ({ ...previous, [field]: value }));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailure("");
    try {
      const result = await api<{ version: number }>(
        "/tenant/settings",
        {
          method: "PATCH",
          body: JSON.stringify({
            expectedVersion: version,
            configuration: draft,
          }),
        },
        csrfToken,
      );
      onSaved(result.version);
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="routing-form">
      {failure && <ErrorNotice message={failure} />}
      <section className="panel content-panel">
        <h2>Identidade e plantão</h2>
        <div className="form-grid">
          <div>
            <label htmlFor="public-name">Nome usado no atendimento</label>
            <input
              id="public-name"
              value={draft.publicName}
              onChange={(e) => update("publicName", e.target.value)}
              required
              minLength={2}
              maxLength={120}
            />
          </div>
          <div>
            <label htmlFor="timezone">Fuso horário</label>
            <select
              id="timezone"
              value={draft.timezone}
              onChange={(e) => update("timezone", e.target.value)}
            >
              <option value="America/Sao_Paulo">Brasília — São Paulo</option>
              <option value="America/Manaus">Manaus</option>
              <option value="America/Rio_Branco">Rio Branco</option>
              <option value="America/Noronha">Fernando de Noronha</option>
            </select>
          </div>
          <div className="full-width">
            <label htmlFor="on-call">Contato de plantão</label>
            <select
              id="on-call"
              value={draft.contactId ?? ""}
              onChange={(e) => update("contactId", e.target.value || null)}
            >
              <option value="">Escolha um contato</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} —{" "}
                  {c.verified ? "Verificado" : "Verificação pendente"}
                </option>
              ))}
            </select>
            <small>
              Somente contatos verificados permitem publicar a configuração.
            </small>
          </div>
        </div>
      </section>
      <RoutingHours draft={draft} update={update} />
      <section className="panel content-panel">
        <h2>Encaminhamento humano</h2>
        <label className="checkbox-label">
          <input type="checkbox" checked disabled /> Sempre tentar transferir
          quando a pessoa pedir atendimento humano
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={draft.transferOnImmediateHospitalRequest}
            onChange={(e) =>
              update("transferOnImmediateHospitalRequest", e.target.checked)
            }
          />{" "}
          Transferir quando houver pedido explícito de atendimento imediato do
          hospital
        </label>
        <div className="form-grid">
          <div>
            <label htmlFor="timeout">Tempo de tentativa (segundos)</label>
            <input
              id="timeout"
              type="number"
              min={15}
              max={60}
              value={draft.timeoutSeconds}
              onChange={(e) => update("timeoutSeconds", Number(e.target.value))}
              required
            />
          </div>
          <div>
            <label htmlFor="attempts">Máximo de tentativas</label>
            <select
              id="attempts"
              value={draft.maxAttempts}
              onChange={(e) => update("maxAttempts", Number(e.target.value))}
            >
              <option value={1}>1 tentativa</option>
              <option value={2}>2 tentativas</option>
            </select>
          </div>
        </div>
        <label htmlFor="closing">Mensagem ao encerrar</label>
        <textarea
          id="closing"
          value={draft.closingMessage}
          onChange={(e) => update("closingMessage", e.target.value)}
          minLength={20}
          maxLength={500}
          required
          rows={3}
        />
        <label htmlFor="fallback">Mensagem se a conexão falhar</label>
        <textarea
          id="fallback"
          value={draft.fallbackMessage}
          onChange={(e) => update("fallbackMessage", e.target.value)}
          minLength={20}
          maxLength={500}
          required
          rows={3}
        />
        <small>
          Não prometa horário de retorno nem confirme ações sem evidência.
        </small>
      </section>
      <div className="save-bar">
        <span>
          Salvar cria uma nova versão. A publicação é uma ação separada.
        </span>
        <Button type="submit" disabled={busy}>
          {busy ? "Salvando…" : "Salvar nova versão"}
        </Button>
      </div>
    </form>
  );
}
