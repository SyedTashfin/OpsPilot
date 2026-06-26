export function getServiceName(): string {
  return "@opspilot/api";
}

if (process.env.NODE_ENV !== "test") {
  console.log(JSON.stringify({ service: getServiceName(), status: "scaffolded" }));
}
