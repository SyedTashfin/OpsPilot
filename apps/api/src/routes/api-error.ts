import type { FastifyReply } from "fastify";

export type ApiErrorPayload = {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details: Record<string, unknown>;
  };
};

export function apiError(
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): ApiErrorPayload {
  return { error: { code, message, details } };
}

export function sendApiError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): FastifyReply {
  return reply.code(statusCode).send(apiError(code, message, details));
}
