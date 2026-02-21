export const APP_NAME = "MetricsHub";

export const PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    maxOrganizations: 1,
  },
  PRO: {
    name: "Pro",
    price: 900, // $9.00 in cents
    maxOrganizations: 5,
  },
} as const;

export type PlanType = keyof typeof PLANS;
