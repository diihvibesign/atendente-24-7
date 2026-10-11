"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, PhoneCall, Clock3 } from "lucide-react";
import type { Case } from "@atendente/contracts";
import { useResource } from "../../lib/resource";
import {
  PageHeader,
  Button,
  Loading,
  ErrorNotice,
  Empty,
  CaseStatus,
  fieldText,
  formatDate,
} from "../../components/ui";
export default function Cases() {
  const [filter, setFilter] = useState("");
  const { data, error, loading, reload } = useResource<Case[]>(
    `/cases${filter ? `?status=${filter}` : ""}`,
  );
  return (
    <>
      <PageHeader
        title="Atendimentos"
        description="Acompanhe cada pedido e dê continuidade ao cuidado."
        action={
          <Button className="secondary" onClick={reload}>
            Atualizar lista
          </Button>
        }
      />
      <div className="notice">
        <PhoneCall size={19} aria-hidden="true" />
        <span>
          As ligações serão ativadas após a validação do plantão.{" "}
          <Link href="/app/configuracao">Preparar atendimento</Link>
        </span>
      </div>
      {data?.some((item) => item.source === "synthetic") && (
        <p className="demo-label">
          Demonstração com dados sintéticos. Nenhuma ligação ou mensagem foi
          enviada.
        </p>
      )}
      <section className="queue-summary" aria-label="Resumo da lista">
        <div>
          <Clock3 size={20} aria-hidden="true" />
          <span>
            Aguardando retorno
            <strong>
              {data?.filter((item) => item.status === "open").length ?? "—"}
            </strong>
          </span>
        </div>
        <div>
          <span>
            Prioridade urgente
            <strong>
              {data?.filter(
                (item) => item.priority === "urgent" && item.status === "open",
              ).length ?? "—"}
            </strong>
          </span>
        </div>
        <p>
          Contagem dos até 100 atendimentos
          <br />
          exibidos nesta lista.
        </p>
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>Fila de atendimento</h2>
          <label className="inline-filter" htmlFor="status-filter">
            Status
            <select
              id="status-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="">Todos</option>
              <option value="open">Aguardando retorno</option>
              <option value="contacted">Contato realizado</option>
              <option value="closed">Encerrado</option>
            </select>
          </label>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorNotice message={error} retry={reload} />
        ) : !data?.length ? (
          <Empty title="Nenhum atendimento por aqui">
            Os pedidos recebidos aparecerão nesta lista quando a telefonia
            estiver ativa.
          </Empty>
        ) : (
          <ul className="case-list">
            {data.map((item) => (
              <li key={item.id}>
                <Link
                  className="case-row"
                  href={`/app/atendimentos/${item.id}`}
                >
                  <span className={`case-mark ${item.priority}`}>
                    <PhoneCall size={19} aria-hidden="true" />
                  </span>
                  <div className="case-person">
                    <strong>{fieldText(item.caller)}</strong>
                    <span>{fieldText(item.need)}</span>
                  </div>
                  <div className="case-state">
                    {item.priority === "urgent" && (
                      <span className="priority">Urgente</span>
                    )}
                    <CaseStatus status={item.status} />
                  </div>
                  <time dateTime={item.createdAt}>
                    {formatDate(item.createdAt)}
                  </time>
                  <ArrowUpRight size={20} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
