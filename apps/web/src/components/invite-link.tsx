"use client";
import { useState } from "react";
import { Button } from "./ui";
export function InviteLink({ url }: { url: string }) {
  const [message, setMessage] = useState("");
  return (
    <div className="invite-result">
      <label htmlFor="activation-link">
        Link de ativação, válido por 48 horas
      </label>
      <input id="activation-link" value={url} readOnly />
      <p>
        Confirme o destinatário e entregue por canal seguro. O link permite
        definir a senha.
      </p>
      <Button
        className="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setMessage("Link copiado.");
          } catch {
            setMessage("Selecione o campo e copie o link manualmente.");
          }
        }}
      >
        Copiar link
      </Button>
      <span role="status">{message}</span>
    </div>
  );
}
