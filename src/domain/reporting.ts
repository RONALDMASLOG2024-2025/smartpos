import type { Product, Sale } from "./types";
import { dayKey } from "./rules";
export function productPerformance(products: Product[], sales: Sale[]) {
  return products
    .map((p) => {
      const items = sales
        .flatMap((s) => s.items)
        .filter((i) => i.product_id === p.id);
      return {
        product_id: p.id,
        sku: p.sku,
        name: p.name,
        units: items.reduce((sum, i) => sum + i.quantity, 0),
        revenue_cents: items.reduce((sum, i) => sum + i.line_total_cents, 0),
      };
    })
    .sort((a, b) => b.units - a.units);
}
export function dailySales(sales: Sale[], days = 14, now = new Date()) {
  const end = new Date(`${dayKey(now)}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(end.getTime() - (days - 1 - i) * 86400000)
      .toISOString()
      .slice(0, 10);
    const selected = sales.filter((s) => dayKey(s.created_at) === date);
    return {
      date,
      total_cents: selected.reduce((sum, s) => sum + s.total_cents, 0),
      transactions: selected.length,
    };
  });
}
