import { normalisePhone } from "./phone";

export function whatsappLink(number: string, message?: string): string {
  const digits = (normalisePhone(number) ?? number).replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
