import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ApiConfig } from "../config.js";
import { sendApiError } from "../routes/api-error.js";

const sessionCookie = "opspilot_session";
const csrfHeader = "x-opspilot-csrf";
const ttlMs = 30 * 60 * 1000;
const mutations = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const publicMutationPaths = new Set(["/api/auth/login"]);

export class BoundedRateLimiter {
  private readonly attempts = new Map<string, number[]>();
  constructor(
    private readonly maxKeys: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  allow(key: string, max: number, windowMs: number): boolean {
    const now = this.now();
    for (const [entryKey, times] of this.attempts) {
      const recent = times.filter((time) => now - time < windowMs);
      if (recent.length === 0) this.attempts.delete(entryKey);
      else this.attempts.set(entryKey, recent);
    }
    if (!this.attempts.has(key) && this.attempts.size >= this.maxKeys) {
      const oldest = this.attempts.keys().next().value;
      if (oldest) this.attempts.delete(oldest);
    }
    const recent = this.attempts.get(key) ?? [];
    if (recent.length >= max) return false;
    recent.push(now);
    this.attempts.set(key, recent);
    return true;
  }

  size(): number {
    return this.attempts.size;
  }

  has(key: string): boolean {
    return this.attempts.has(key);
  }
}

const loginAttempts = new BoundedRateLimiter(256);
const investigationAttempts = new BoundedRateLimiter(512);

type SessionPayload = { exp: number; sid: string; csrf: string };

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}
function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const [key, value] = part.trim().split("=");
    if (key && value) cookies[key] = value;
  }
  return cookies;
}
function createSession(secret: string): { token: string; csrf: string; expiresAt: string } {
  const payload: SessionPayload = {
    exp: Date.now() + ttlMs,
    sid: randomBytes(16).toString("hex"),
    csrf: randomBytes(16).toString("base64url"),
  };
  const data = b64url(JSON.stringify(payload));
  return {
    token: `${data}.${sign(data, secret)}`,
    csrf: payload.csrf,
    expiresAt: new Date(payload.exp).toISOString(),
  };
}
function readSession(request: FastifyRequest, secret: string | undefined): SessionPayload | null {
  if (!secret) return null;
  const token = parseCookies(request.headers.cookie)[sessionCookie];
  if (!token) return null;
  const [data, mac] = token.split(".");
  if (!data || !mac || !safeEqual(sign(data, secret), mac)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as SessionPayload;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}
function sameSecret(input: string, expected: string): boolean {
  return safeEqual(
    createHmac("sha256", "opspilot-access").update(input).digest("hex"),
    createHmac("sha256", "opspilot-access").update(expected).digest("hex"),
  );
}
function isAllowedOrigin(origin: string | undefined, allowed: readonly string[]): boolean {
  return !origin || allowed.includes(origin);
}
function sessionCookieAttributes(secure: boolean): string {
  return `Path=/; HttpOnly; SameSite=Lax;${secure ? " Secure;" : ""}`;
}
function setSessionCookie(reply: FastifyReply, token: string, secure: boolean): void {
  reply.header(
    "set-cookie",
    `${sessionCookie}=${token}; ${sessionCookieAttributes(secure)} Max-Age=${ttlMs / 1000}`,
  );
}
function clearSessionCookie(reply: FastifyReply, secure: boolean): void {
  reply.header("set-cookie", `${sessionCookie}=; ${sessionCookieAttributes(secure)} Max-Age=0`);
}

export function registerSecurity(app: FastifyInstance, config: ApiConfig): void {
  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && !isAllowedOrigin(origin, config.allowedOrigins))
      return sendApiError(reply, 403, "origin_forbidden", "Origin is not allowed.");
    if (origin) {
      reply.header("access-control-allow-origin", origin);
      reply.header("access-control-allow-credentials", "true");
      reply.header("vary", "origin");
    }
    if (request.method === "OPTIONS") {
      reply.header("access-control-allow-methods", "GET,POST,OPTIONS");
      reply.header("access-control-allow-headers", `content-type, ${csrfHeader}`);
      return reply.code(204).send();
    }
  });

  app.post("/api/auth/login", async (request, reply) => {
    const key = request.ip;
    if (!loginAttempts.allow(key, 5, 60_000))
      return sendApiError(reply, 429, "login_rate_limited", "Too many login attempts.");
    if (request.headers["content-type"]?.split(";")[0] !== "application/json")
      return sendApiError(reply, 415, "json_required", "JSON content type is required.");
    const body = request.body as { accessCode?: string } | undefined;
    if (
      !config.portfolioAccessCode ||
      !config.sessionSecret ||
      !body?.accessCode ||
      !sameSecret(body.accessCode, config.portfolioAccessCode)
    )
      return sendApiError(reply, 401, "auth_failed", "Invalid access code.");
    const session = createSession(config.sessionSecret);
    setSessionCookie(reply, session.token, process.env.NODE_ENV === "production");
    return { authenticated: true, csrfToken: session.csrf, expiresAt: session.expiresAt };
  });
  app.post("/api/auth/logout", async (_request, reply) => {
    clearSessionCookie(reply, process.env.NODE_ENV === "production");
    return { authenticated: false };
  });
  app.get("/api/auth/session", (request) => {
    const session = readSession(request, config.sessionSecret);
    return session
      ? {
          authenticated: true,
          csrfToken: session.csrf,
          expiresAt: new Date(session.exp).toISOString(),
        }
      : { authenticated: false };
  });

  app.addHook("preHandler", async (request, reply) => {
    if (
      !mutations.has(request.method) ||
      publicMutationPaths.has(request.url.split("?")[0] ?? request.url)
    )
      return;
    if (request.headers["content-type"]?.split(";")[0] !== "application/json")
      return sendApiError(reply, 415, "json_required", "JSON content type is required.");
    const session = readSession(request, config.sessionSecret);
    if (config.authRequired && !session)
      return sendApiError(reply, 401, "authentication_required", "Authentication required.");
    if (config.authRequired && request.headers[csrfHeader] !== session?.csrf)
      return sendApiError(reply, 403, "csrf_failed", "CSRF validation failed.");
    if (
      request.url.includes("/investigations") &&
      !investigationAttempts.allow(session?.sid ?? request.ip, 3, 60_000)
    )
      return sendApiError(
        reply,
        429,
        "investigation_rate_limited",
        "Too many investigation requests.",
      );
  });
}
