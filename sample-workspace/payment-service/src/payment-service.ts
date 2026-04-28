export type PaymentRequest = {
  orderId: string;
  amountCents: number;
  currency: "CNY" | "USD";
};

export type PaymentResult = {
  orderId: string;
  status: "authorized" | "declined";
  providerReference: string;
};

export function authorizePayment(request: PaymentRequest): PaymentResult {
  return {
    orderId: request.orderId,
    status: request.amountCents > 0 ? "authorized" : "declined",
    providerReference: `mock-pay-${request.orderId}`,
  };
}
