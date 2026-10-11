import { z } from "zod";

export const idSchema = z.uuid();
export const emailSchema = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
export const passwordSchema = z.string().min(12).max(128);
export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
    otp: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
  })
  .strict();
export const acceptInviteSchema = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/),
    password: passwordSchema,
  })
  .strict();
export const inviteSchema = z
  .object({ name: z.string().trim().min(2).max(120), email: emailSchema })
  .strict();
export const tenantSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: emailSchema,
    contactName: z.string().trim().min(2).max(120),
  })
  .strict();
export const tenantStateSchema = z
  .object({ status: z.enum(["active", "inactive"]) })
  .strict();
export const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().regex(/^\+55\d{10,11}$/),
  })
  .strict();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const routingSchema = z
  .object({
    publicName: z.string().trim().min(2).max(120),
    timezone: z.string().refine((value) => {
      try {
        new Intl.DateTimeFormat("pt-BR", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Fuso horário inválido"),
    contactId: idSchema.nullable(),
    hours: z
      .array(
        z
          .object({
            day: z.number().int().min(0).max(6),
            opensAt: time,
            closesAt: time,
          })
          .strict()
          .refine(
            (h) => h.opensAt < h.closesAt,
            "O fechamento precisa ocorrer após a abertura",
          ),
      )
      .max(7)
      .refine(
        (h) => new Set(h.map((x) => x.day)).size === h.length,
        "Dia duplicado",
      ),
    exceptions: z
      .array(z.object({ date: z.iso.date(), closed: z.boolean() }).strict())
      .max(60)
      .refine(
        (h) => new Set(h.map((x) => x.date)).size === h.length,
        "Data duplicada",
      ),
    transferOnHumanRequest: z.literal(true),
    transferOnImmediateHospitalRequest: z.boolean(),
    timeoutSeconds: z.number().int().min(15).max(60),
    maxAttempts: z.number().int().min(1).max(2),
    closingMessage: z.string().trim().min(20).max(500),
    fallbackMessage: z.string().trim().min(20).max(500),
  })
  .strict();
export const saveRoutingSchema = z
  .object({
    expectedVersion: z.number().int().min(0),
    configuration: routingSchema,
  })
  .strict();
export const publishRoutingSchema = z
  .object({ version: z.number().int().positive() })
  .strict();
export const caseUpdateSchema = z
  .object({
    status: z.enum(["open", "contacted", "closed"]),
    note: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();
export type Routing = z.infer<typeof routingSchema>;
export type Actor = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  tenantId: string | null;
  tenantName: string | null;
};
export type Session = { user: Actor; csrfToken: string };
export type Contact = {
  id: string;
  name: string;
  phone: string;
  verified: boolean;
};
export type RoutingVersion = {
  version: number;
  configuration: Routing;
  publishedAt: string | null;
  createdAt: string;
};
export type Settings = {
  latest: RoutingVersion | null;
  publishedVersion: number | null;
  contacts: Contact[];
};
export type StructuredField = {
  status: "known" | "declined" | "unknown" | "not_asked";
  value?: string;
};
export type Case = {
  id: string;
  status: "open" | "contacted" | "closed";
  priority: "normal" | "urgent";
  caller: StructuredField;
  callbackPhone: StructuredField;
  deceased: StructuredField;
  location: StructuredField;
  need: StructuredField;
  createdAt: string;
  updatedAt: string;
  configurationVersion: number | null;
  source: "synthetic" | "phone";
  notificationStatus: "not_sent" | "queued" | "sent" | "delivered" | "failed";
  transferStatus: "not_requested" | "pending" | "connected" | "failed";
};
export type CaseDetail = Case & {
  notes: { id: string; text: string; createdAt: string }[];
};
export type Tenant = {
  id: string;
  name: string;
  status: "active" | "inactive";
  createdAt: string;
  usersCount: number;
  publishedVersion: number | null;
};
export type TeamUser = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  activated: boolean;
};
export function defaultRouting(name: string): Routing {
  return {
    publicName: name,
    timezone: "America/Sao_Paulo",
    contactId: null,
    hours: [1, 2, 3, 4, 5].map((day) => ({
      day,
      opensAt: "08:00",
      closesAt: "18:00",
    })),
    exceptions: [],
    transferOnHumanRequest: true,
    transferOnImmediateHospitalRequest: true,
    timeoutSeconds: 30,
    maxAttempts: 1,
    closingMessage:
      "Registrei seu pedido para a equipe continuar o atendimento. Não consigo confirmar o horário do retorno.",
    fallbackMessage:
      "Não consegui completar a conexão com o responsável. Seu pedido ficou registrado para retorno da equipe.",
  };
}
