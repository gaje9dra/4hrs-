export function formatCatalogMoney(amount: string, currency: string): string {
  const normalizedAmount = amount.trim();
  const normalizedCurrency = currency.trim().toUpperCase();
  return normalizedCurrency ? normalizedCurrency + " " + normalizedAmount : normalizedAmount;
}
