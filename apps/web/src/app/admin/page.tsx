"use client";
import { useState, type FormEvent } from "react";
import { Building2, Plus } from "lucide-react";
import type { Tenant } from "@atendente/contracts";
import { useResource } from "../../lib/resource";
import { useSession } from "../../components/session";
import {
  PageHeader,
  Button,
  ErrorNotice,
  Loading,
  Empty,
} from "../../components/ui";
import { InviteLink } from "../../components/invite-link";
import { api, errorMessage } from "../../lib/api";
export default function Admin() {
  const { data, error, loading, reload } =
    useResource<Tenant[]>("/admin/tenants");
  const { session } = useSession();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFailure("");
    const values = new FormData(event.currentTarget);
    try {
      const result = await api<{ activationUrl: string }>(
        "/admin/tenants",
        {
          method: "POST",
          body: JSON.stringify({
            name: values.get("name"),
            contactName: values.get("contactName"),
            email: values.get("email"),
          }),
        },
        session!.csrfToken,
      );
      setLink(result.activationUrl);
      setCreating(false);
      setMessage(
        "Funerária criada. Entregue o link de ativação ao responsável.",
      );
      reload();
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function toggle(tenant: Tenant) {
    setBusy(true);
    setFailure("");
    try {
      await api(
        `/admin/tenants/${tenant.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: tenant.status === "active" ? "inactive" : "active",
          }),
        },
        session!.csrfToken,
      );
      setMessage("Acesso ao painel atualizado.");
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
        title="Funerárias"
        description="Organize as empresas e o acesso de cada equipe."
        action={
          <Button
            onClick={() => {
              setCreating(!creating);
              setLink("");
            }}
          >
            <Plus size={18} aria-hidden="true" />
            Nova funerária
          </Button>
        }
      />
      <div className="notice">
        <Building2 size={20} aria-hidden="true" />
        <span>
          Esta área administra empresas e acessos. O conteúdo dos atendimentos
          fica no painel de cada funerária.
        </span>
      </div>
      {failure && <ErrorNotice message={failure} />}
      <p className="success" role="status">
        {message}
      </p>
      {link && <InviteLink url={link} />}{" "}
      {creating && (
        <section className="panel content-panel">
          <h2>Criar funerária</h2>
          <form onSubmit={create} className="form-grid">
            <div>
              <label htmlFor="tenant-name">Nome da funerária</label>
              <input
                id="tenant-name"
                name="name"
                required
                minLength={2}
                maxLength={120}
              />
            </div>
            <div>
              <label htmlFor="contact-name">Nome do responsável</label>
              <input
                id="contact-name"
                name="contactName"
                required
                minLength={2}
                maxLength={120}
              />
            </div>
            <div>
              <label htmlFor="contact-email">E-mail do responsável</label>
              <input
                id="contact-email"
                name="email"
                type="email"
                required
                maxLength={254}
              />
            </div>
            <div className="form-actions">
              <Button type="submit" disabled={busy}>
                {busy ? "Criando…" : "Criar e gerar convite"}
              </Button>
              <Button className="secondary" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="section-heading">
          <h2>Empresas cadastradas</h2>
          <span className="muted">{data?.length ?? 0} nesta lista</span>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorNotice message={error} retry={reload} />
        ) : !data?.length ? (
          <Empty title="Sua primeira funerária começa aqui">
            Crie a empresa e convide seu responsável para configurar o
            atendimento.
          </Empty>
        ) : (
          <ul className="tenant-list">
            {data.map((tenant) => (
              <li key={tenant.id}>
                <span className="tenant-icon">
                  <Building2 size={23} aria-hidden="true" />
                </span>
                <div className="tenant-description">
                  <h3>{tenant.name}</h3>
                  <p>
                    {tenant.usersCount} acesso(s) ativo(s) ·{" "}
                    {tenant.publishedVersion
                      ? `Configuração publicada v${tenant.publishedVersion}`
                      : "Configuração pendente"}
                  </p>
                </div>
                <span
                  className={`badge ${tenant.status === "active" ? "green" : "neutral"}`}
                >
                  {tenant.status === "active"
                    ? "Painel ativo"
                    : "Painel desativado"}
                </span>
                {confirm === tenant.id ? (
                  <div className="confirm-inline">
                    <p>
                      Desativar o painel desta empresa?
                      <br />O estado da telefonia é separado.
                    </p>
                    <Button disabled={busy} onClick={() => toggle(tenant)}>
                      Desativar painel
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
                    onClick={() =>
                      tenant.status === "active"
                        ? setConfirm(tenant.id)
                        : toggle(tenant)
                    }
                    aria-label={`${tenant.status === "active" ? "Desativar" : "Ativar"} painel de ${tenant.name}`}
                  >
                    {tenant.status === "active"
                      ? "Desativar painel"
                      : "Ativar painel"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
