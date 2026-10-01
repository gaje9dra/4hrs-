import { Badge } from "@/components/ui/badge";

type OrderStatus = "PENDING" | "CONFIRMED";

const labels: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
};

const variants: Record<OrderStatus, "yellow" | "blue"> = {
  PENDING: "yellow",
  CONFIRMED: "blue",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={variants[status]} aria-label={`Order status: ${labels[status]}`}>
      {labels[status]}
    </Badge>
  );
}
