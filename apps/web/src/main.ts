import { createServer } from "node:http";

export function getServiceName(): string {
  return "@opspilot/web";
}

export function createHealthResponse(): Record<string, string> {
  return { service: getServiceName(), status: "scaffolded" };
}

export function startPlaceholderServer(port: number): void {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(createHealthResponse()));
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(JSON.stringify({ ...createHealthResponse(), port }));
  });
}

if (process.env.NODE_ENV !== "test") {
  startPlaceholderServer(Number(process.env.PORT ?? 3000));
}
