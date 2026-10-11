"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Phone,
  Settings,
  Users,
  Building2,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useSession } from "./session";
import { Brand, Button, ErrorNotice, Loading } from "./ui";
import { api, errorMessage } from "../lib/api";
export function Shell({
  children,
  role,
}: {
  children: ReactNode;
  role: "admin" | "user";
}) {
  const { session, setSession, error } = useSession();
  const path = usePathname();
  const router = useRouter();
  const [failure, setFailure] = useState("");
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (session && session.user.role !== role)
      router.replace(session.user.role === "admin" ? "/admin" : "/app");
  }, [session, role, router]);
  if (error)
    return (
      <main className="standalone">
        <ErrorNotice message={error} retry={() => window.location.reload()} />
      </main>
    );
  if (!session || session.user.role !== role)
    return (
      <main className="standalone">
        <Loading />
      </main>
    );
  const links =
    role === "admin"
      ? [{ href: "/admin", label: "Funerárias", icon: Building2 }]
      : [
          { href: "/app", label: "Atendimentos", icon: LayoutDashboard },
          {
            href: "/app/configuracao",
            label: "Atendimento e plantão",
            icon: Settings,
          },
          { href: "/app/equipe", label: "Equipe e acessos", icon: Users },
        ];
  async function logout() {
    setLeaving(true);
    try {
      await api("/auth/logout", { method: "POST" }, session!.csrfToken);
      setSession(null);
      router.replace("/login");
    } catch (error) {
      setFailure(errorMessage(error));
      setLeaving(false);
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <Link
          href={role === "admin" ? "/admin" : "/app"}
          aria-label="Atendente 24/7 início"
        >
          <Brand />
        </Link>
        <div className="workspace-label">
          {role === "admin" ? (
            <>
              <ShieldCheck size={16} aria-hidden="true" /> Administração
            </>
          ) : (
            session.user.tenantName
          )}
        </div>
        <nav aria-label="Navegação principal">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={path === href ? "active" : ""}
              aria-current={path === href ? "page" : undefined}
            >
              <Icon size={19} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <Phone size={18} aria-hidden="true" />
          <strong>Telefonia pendente</strong>
          <p>O atendimento por ligação ainda não foi ativado.</p>
        </div>
        <div className="account">
          <span>{session.user.name}</span>
          <small>
            {role === "admin" ? "Admin com MFA" : "Conta da funerária"}
          </small>
          <Button className="text-button" onClick={logout} disabled={leaving}>
            <LogOut size={17} aria-hidden="true" />
            {leaving ? "Saindo…" : "Sair da conta"}
          </Button>
        </div>
      </aside>
      <main id="main" className="workspace" tabIndex={-1}>
        {failure && <ErrorNotice message={failure} />}
        {children}
      </main>
    </div>
  );
}
