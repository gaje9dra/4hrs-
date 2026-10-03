export type AddressLike = {
  recipientName: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  countryCode: string;
};

export function formatAddress(address: AddressLike, locale: "en-IN" | "en-US"): string {
  const country = address.countryCode.toUpperCase();
  const lines = [address.recipientName, address.addressLine1, address.addressLine2 ?? ""].filter(Boolean);
  lines.push(`${address.city}, ${address.stateOrProvince} ${address.postalCode}`);
  lines.push(country);
  return lines.join(", ");
}