// Provider choice is an admin setting (SRS A-5); requirements are provider-agnostic.
import { paystackFailureMessage } from "./paystack";

export type PaymentProvider = "paystack" | "flutterwave";

export function paymentProviderFor(settings: { provider?: string } | undefined): PaymentProvider {
  return settings?.provider === "flutterwave" ? "flutterwave" : "paystack";
}

/** Is the chosen provider's secret configured on the server? */
export function providerConfigured(provider: PaymentProvider): boolean {
  return provider === "flutterwave" ? Boolean(process.env.FLW_SECRET_KEY) : Boolean(process.env.PAYSTACK_SECRET_KEY);
}

/** Plain-language explanation of a provider's failure reason (FR-PAY-006). The wording is shared. */
export const providerFailureMessage = paystackFailureMessage;
