export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits || digits.length < 8 || digits.length > 15) throw new Error("INVALID_PHONE");
  return `+${digits}`;
}

export function formatPhoneForDisplay(phone: string, countryCode: string): string {
  const normalized = normalizePhone(phone);
  const digits = normalized.slice(1);
  const country = countryCode.toUpperCase();
  if (country === "IN" && digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  if (country === "US" && digits.length === 11 && digits.startsWith("1")) return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return normalized;
}