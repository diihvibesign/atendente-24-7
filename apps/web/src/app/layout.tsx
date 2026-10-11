import type { Metadata } from "next";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "./globals.css";
import { SessionProvider } from "../components/session";
export const metadata: Metadata = {
  title: {
    default: "Atendente 24/7 | Painel de atendimento funerário",
    template: "%s | Atendente 24/7",
  },
  description:
    "Acesse o painel da sua funerária para acompanhar pedidos de atendimento, organizar a equipe e configurar os contatos de plantão.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
