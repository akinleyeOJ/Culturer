import { supabase } from "../supabase";

export interface StripeConnectStatus {
  accountId: string | null;
  onboarded: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsCurrentlyDue: string[];
  requirementsPastDue: string[];
}

export interface StripeConnectOnboardingLink {
  accountId: string;
  onboardingUrl: string;
}

const DEFAULT_STATUS: StripeConnectStatus = {
  accountId: null,
  onboarded: false,
  chargesEnabled: false,
  payoutsEnabled: false,
  requirementsCurrentlyDue: [],
  requirementsPastDue: [],
};

export async function fetchStripeConnectStatus(): Promise<StripeConnectStatus> {
  const { data, error } = await supabase.functions.invoke(
    "stripe-connect-onboard",
    { body: { action: "status" } },
  );

  if (error) throw error;
  if (!data?.success) {
    throw new Error(data?.error || "Failed to load payout status");
  }

  return {
    accountId: data.account_id ?? null,
    onboarded: Boolean(data.onboarded),
    chargesEnabled: Boolean(data.charges_enabled),
    payoutsEnabled: Boolean(data.payouts_enabled),
    requirementsCurrentlyDue: Array.isArray(data.requirements_currently_due)
      ? data.requirements_currently_due
      : [],
    requirementsPastDue: Array.isArray(data.requirements_past_due)
      ? data.requirements_past_due
      : [],
  };
}

export async function createStripeConnectOnboardingLink(): Promise<StripeConnectOnboardingLink> {
  const { data, error } = await supabase.functions.invoke(
    "stripe-connect-onboard",
    { body: { action: "onboard" } },
  );

  if (error) throw error;
  if (!data?.success || !data?.onboarding_url || !data?.account_id) {
    throw new Error(data?.error || "Failed to start onboarding");
  }

  return {
    accountId: data.account_id,
    onboardingUrl: data.onboarding_url,
  };
}

export const emptyStripeConnectStatus = () => ({ ...DEFAULT_STATUS });
