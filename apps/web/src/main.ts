import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createDashboardHtml, resolveDashboardConfig } from "./dashboard.js";
import { clientScript } from "./static/app.js";
import { dashboardStyles } from "./static/styles.js";

export function getServiceName(): string {
  return "@opspilot/web";
}

export function createHealthResponse(): Record<string, string> {
  return { service: getServiceName(), status: "ready" };
}

function send(
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  body: string,
): void {
  response.writeHead(statusCode, {
    "content-type": contentType,
    "cache-control": "no-store",
  });
  response.end(body);
}

export function handleDashboardRequest(request: IncomingMessage, response: ServerResponse): void {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname === "/health") {
    send(response, 200, "application/json; charset=utf-8", JSON.stringify(createHealthResponse()));
    return;
  }
  if (url.pathname === "/assets/styles.css") {
    send(response, 200, "text/css; charset=utf-8", dashboardStyles);
    return;
  }
  if (url.pathname === "/assets/app.js") {
    send(response, 200, "text/javascript; charset=utf-8", clientScript);
    return;
  }
  if (url.pathname === "/" || url.pathname === "/dashboard") {
    send(response, 200, "text/html; charset=utf-8", createDashboardHtml(resolveDashboardConfig()));
    return;
  }
  send(response, 404, "text/plain; charset=utf-8", "Not found");
}

export function startDashboardServer(port: number): void {
  const server = createServer(handleDashboardRequest);
  server.listen(port, "0.0.0.0", () => {
    console.log(JSON.stringify({ ...createHealthResponse(), port }));
  });
}

if (process.env.NODE_ENV !== "test") {
  startDashboardServer(Number(process.env.PORT ?? 3000));
}
