export function getServiceName(): string {
  return "@opspilot/demo-service";
}

export function createHeartbeat(): Record<string, string> {
  return { service: getServiceName(), status: "scaffolded" };
}

if (process.env.NODE_ENV !== "test") {
  console.log(JSON.stringify(createHeartbeat()));
  setInterval(() => console.log(JSON.stringify(createHeartbeat())), 30000);
}
