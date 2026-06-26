import { beautyCorpServices } from "./services.js";

export type SyntheticDeployment = {
  readonly serviceName: string;
  readonly version: string;
  readonly commitSha: string;
  readonly deployedBy: string;
  readonly environment: "production";
  readonly status: "succeeded" | "failed" | "rolled_back";
  readonly deployedAt: string;
  readonly metadata: Record<string, string>;
};

const serviceVersions: Record<string, string> = {
  "recommendation-service": "rec-2026.06.1",
  "customer-chat-service": "chat-2026.06.4",
  "inventory-service": "inv-2026.06.3",
  "payment-service": "pay-2026.06.2",
  "image-analysis-service": "img-2026.06.5",
};

const commitShas: Record<string, string> = {
  "recommendation-service": "8f4c2a91",
  "customer-chat-service": "31be9a77",
  "inventory-service": "60df3e14",
  "payment-service": "19ac7b44",
  "image-analysis-service": "be71d905",
};

export function generateDeployments(): SyntheticDeployment[] {
  return beautyCorpServices.map((service, index) => ({
    serviceName: service.name,
    version: serviceVersions[service.name] ?? `${service.name}-2026.06.0`,
    commitSha: commitShas[service.name] ?? "00000000",
    deployedBy: "beautycorp-deploy-bot",
    environment: "production",
    status: "succeeded",
    deployedAt: new Date(Date.UTC(2026, 5, 26, 9, 42 - index * 8, 0)).toISOString(),
    metadata:
      service.name === "recommendation-service"
        ? { change: "feature-store timeout tuning", risk: "medium" }
        : { change: "routine service update", risk: "low" },
  }));
}
