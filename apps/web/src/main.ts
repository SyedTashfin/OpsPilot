export function getServiceName(): string {
  return "@opspilot/web";
}

if (process.env.NODE_ENV !== "test") {
  console.log(JSON.stringify({ service: getServiceName(), status: "scaffolded" }));
}
