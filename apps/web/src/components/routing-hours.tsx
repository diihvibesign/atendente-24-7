"use client";
import { useState } from "react";
import type { Routing } from "@atendente/contracts";
import { Button } from "./ui";
const weekdays = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
export function RoutingHours({
  draft,
  update,
}: {
  draft: Routing;
  update: <K extends keyof Routing>(field: K, value: Routing[K]) => void;
}) {
  const [exception, setException] = useState("");
  return (
    <section className="panel content-panel">
      <h2>Horário da equipe</h2>
      <p>
        Horário presencial de cada dia. O atendimento digital será 24/7 após sua
        ativação.
      </p>
      <fieldset className="hours">
        <legend className="visually-hidden">Dias e horários</legend>
        {weekdays.map((label, day) => {
          const hours = draft.hours.find((h) => h.day === day);
          return (
            <div className="hours-row" key={day}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={!!hours}
                  onChange={(e) =>
                    update(
                      "hours",
                      e.target.checked
                        ? [
                            ...draft.hours,
                            { day, opensAt: "08:00", closesAt: "18:00" },
                          ]
                        : draft.hours.filter((h) => h.day !== day),
                    )
                  }
                />
                {label}
              </label>
              {hours ? (
                <div className="hours-times">
                  <label>
                    <span className="visually-hidden">Abertura {label}</span>
                    <input
                      type="time"
                      value={hours.opensAt}
                      required
                      onChange={(e) =>
                        update(
                          "hours",
                          draft.hours.map((h) =>
                            h.day === day
                              ? { ...h, opensAt: e.target.value }
                              : h,
                          ),
                        )
                      }
                    />
                  </label>
                  <span>às</span>
                  <label>
                    <span className="visually-hidden">Fechamento {label}</span>
                    <input
                      type="time"
                      value={hours.closesAt}
                      required
                      onChange={(e) =>
                        update(
                          "hours",
                          draft.hours.map((h) =>
                            h.day === day
                              ? { ...h, closesAt: e.target.value }
                              : h,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              ) : (
                <span className="muted">Fechado</span>
              )}
            </div>
          );
        })}
      </fieldset>
      <h3>Exceções: dias sem expediente</h3>
      <label htmlFor="exception-date">Data</label>
      <div className="inline-controls">
        <input
          id="exception-date"
          type="date"
          value={exception}
          onChange={(e) => setException(e.target.value)}
        />
        <Button
          className="secondary"
          disabled={
            !exception ||
            draft.exceptions.some((item) => item.date === exception) ||
            draft.exceptions.length >= 60
          }
          onClick={() => {
            update("exceptions", [
              ...draft.exceptions,
              { date: exception, closed: true },
            ]);
            setException("");
          }}
        >
          Adicionar data
        </Button>
      </div>
      <ul className="exceptions">
        {draft.exceptions.map((item) => (
          <li key={item.date}>
            {item.date.split("-").reverse().join("/")}
            <Button
              className="text-button"
              onClick={() =>
                update(
                  "exceptions",
                  draft.exceptions.filter((x) => x.date !== item.date),
                )
              }
              aria-label={`Remover exceção ${item.date}`}
            >
              Remover
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
