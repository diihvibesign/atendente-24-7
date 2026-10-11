export class ClientError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  csrfToken?: string,
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new ClientError(
      response.status,
      body?.message ?? "Não foi possível carregar os dados. Tente novamente.",
    );
  return body as T;
}
export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Não foi possível concluir. Tente novamente.";
