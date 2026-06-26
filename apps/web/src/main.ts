import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export interface HealthPayload {
  service: string;
  status: "ok";
  description: string;
}

export function getServiceName(): string {
  return "@opspilot/web";
}

export function getHealthPayload(): HealthPayload {
  return {
    service: getServiceName(),
    status: "ok",
    description: "Next.js dashboard placeholder",
  };
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

export function handleRequest(request: IncomingMessage, response: ServerResponse): void {
  if (request.url === "/health" || request.url === "/api/health") {
    writeJson(response, 200, getHealthPayload());
    return;
  }

  writeJson(response, 200, {
    ...getHealthPayload(),
    message: "OpsPilot scaffold service. Runtime implementation begins in later issues.",
  });
}

export function startServer(port = Number(process.env.PORT ?? 3000)): void {
  const server = createServer(handleRequest);
  server.listen(port, () => {
    console.log(JSON.stringify({ service: getServiceName(), status: "listening", port }));
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}
