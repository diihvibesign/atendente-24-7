import { PhoneIncoming, AlertCircle } from "lucide-react";
import type { ReactNode, ButtonHTMLAttributes } from "react";
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-icon">
        <PhoneIncoming size={22} aria-hidden="true" />
      </span>
      <span>
        Atendente <strong>24/7</strong>
      </span>
    </span>
  );
}
export function Button({
  children,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`button ${className}`} {...props}>
      {children}
    </button>
  );
}
export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="notice error" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <span>{message}</span>
      {retry && (
        <Button className="secondary" onClick={retry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      Carregando…
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export const statusLabels = {
  open: "Aguardando retorno",
  contacted: "Contato realizado",
  closed: "Encerrado",
};
export function CaseStatus({ status }: { status: keyof typeof statusLabels }) {
  return (
    <span className={`badge ${status === "open" ? "amber" : "neutral"}`}>
      {statusLabels[status]}
    </span>
  );
}
export function fieldText(field: { status: string; value?: string }) {
  return field.status === "known"
    ? (field.value ?? "Não informado")
    : ({
        declined: "Preferiu não informar",
        unknown: "Não soube informar",
        not_asked: "Não perguntado",
      }[field.status] ?? "Não informado");
}
export function formatDate(value: string, timezone = "America/Sao_Paulo") {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}
