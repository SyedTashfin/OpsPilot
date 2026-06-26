export type ServiceCriticality = "low" | "medium" | "high" | "critical";

export type BeautyCorpService = {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly ownerTeam: string;
  readonly runtime: string;
  readonly criticality: ServiceCriticality;
};

export const beautyCorpServices = [
  {
    name: "recommendation-service",
    displayName: "Recommendation Service",
    description: "Personalized product recommendation API for BeautyCorp storefronts.",
    ownerTeam: "personalization-platform",
    runtime: "nodejs",
    criticality: "critical",
  },
  {
    name: "customer-chat-service",
    displayName: "Customer Chat Service",
    description: "Customer support assistant backend for product and order questions.",
    ownerTeam: "customer-experience-ai",
    runtime: "python",
    criticality: "high",
  },
  {
    name: "inventory-service",
    displayName: "Inventory Service",
    description: "Inventory availability and warehouse synchronization API.",
    ownerTeam: "supply-chain-platform",
    runtime: "java",
    criticality: "high",
  },
  {
    name: "payment-service",
    displayName: "Payment Service",
    description: "Payment authorization and checkout orchestration service.",
    ownerTeam: "commerce-platform",
    runtime: "go",
    criticality: "critical",
  },
  {
    name: "image-analysis-service",
    displayName: "Image Analysis Service",
    description: "Skin-care image analysis and product matching service.",
    ownerTeam: "beauty-ai-platform",
    runtime: "python",
    criticality: "high",
  },
] as const satisfies readonly BeautyCorpService[];

export function getBeautyCorpService(name: string): BeautyCorpService {
  const service = beautyCorpServices.find((candidate) => candidate.name === name);

  if (!service) {
    throw new Error(`Unknown BeautyCorp service: ${name}`);
  }

  return service;
}
