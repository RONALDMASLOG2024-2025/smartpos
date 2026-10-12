import model from "./model.json";
import type { ForecastResult, Product, Sale } from "../domain/types";
import { dayKey } from "../domain/rules";
const features = (day: number, weekday: number) => [
  1,
  day / 56,
  ...Array.from({ length: 6 }, (_, i) => Number(weekday === i)),
];
function fit(rows: { day: number; weekday: number; quantity: number }[]) {
  const n = 8;
  const m = Array.from({ length: n }, () => Array(n + 1).fill(0) as number[]);
  rows.forEach(({ day, weekday, quantity }) => {
    const x = features(day, weekday);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) m[i][j] += x[i] * x[j];
      m[i][n] += x[i] * quantity;
    }
  });
  for (let i = 0; i < n; i++) m[i][i] += 0.01;
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++)
      if (Math.abs(m[j][i]) > Math.abs(m[pivot][i])) pivot = j;
    [m[i], m[pivot]] = [m[pivot], m[i]];
    const d = m[i][i];
    m[i] = m[i].map((v) => v / d);
    for (let j = 0; j < n; j++)
      if (j !== i) {
        const f = m[j][i];
        m[j] = m[j].map((v, k) => v - f * m[i][k]);
      }
  }
  return m.map((r) => r[n]);
}
const prediction = (weights: number[], day: number, weekday: number) =>
  Math.max(
    0,
    features(day, weekday).reduce((sum, v, i) => sum + v * weights[i], 0),
  );
const weekday = (d: Date) => (d.getUTCDay() + 6) % 7;
export function forecast(
  products: Product[],
  sales: Sale[],
  synthetic: boolean,
  now = new Date(),
): ForecastResult {
  const today = new Date(`${dayKey(now)}T00:00:00Z`);
  const ordered = [...sales].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  const first = ordered.length
    ? new Date(`${dayKey(ordered[0].created_at)}T00:00:00Z`)
    : today;
  const days = Math.floor((today.getTime() - first.getTime()) / 86400000); // excludes incomplete current day
  const source = synthetic ? "synthetic" : days >= 56 ? "real" : "insufficient";
  if (source === "insufficient")
    return {
      source,
      model_version: model.version,
      training_days: days,
      horizon_days: 7,
      validation_mae: null,
      results: [],
    };
  const errors: number[] = [];
  const results = products
    .filter((p) => p.status === "active")
    .flatMap((p) => {
      let weights: number[];
      let trainingDays: number;
      if (synthetic) {
        const trained = model.models[p.sku as keyof typeof model.models];
        if (!trained) return [];
        weights = trained.coefficients;
        trainingDays = trained.training_days;
        errors.push(trained.validation_mae);
      } else {
        const productStart = new Date(`${dayKey(p.created_at)}T00:00:00Z`);
        const start = productStart > first ? productStart : first;
        trainingDays = Math.floor(
          (today.getTime() - start.getTime()) / 86400000,
        );
        if (trainingDays < 56) return [];
        const quantities = new Map<string, number>();
        sales.forEach((s) => {
          const units = s.items
            .filter((i) => i.product_id === p.id)
            .reduce((sum, i) => sum + i.quantity, 0);
          quantities.set(
            dayKey(s.created_at),
            (quantities.get(dayKey(s.created_at)) ?? 0) + units,
          );
        });
        const rows = Array.from({ length: trainingDays }, (_, day) => {
          const d = new Date(start.getTime() + day * 86400000);
          return {
            day,
            weekday: weekday(d),
            quantity: quantities.get(dayKey(d)) ?? 0,
          };
        });
        const validation = fit(rows.slice(0, -14));
        errors.push(
          rows
            .slice(-14)
            .reduce(
              (sum, r) =>
                sum +
                Math.abs(prediction(validation, r.day, r.weekday) - r.quantity),
              0,
            ) / 14,
        );
        weights = fit(rows);
      }
      const units = Math.ceil(
        Array.from({ length: 7 }, (_, i) =>
          prediction(
            weights,
            trainingDays + i,
            weekday(new Date(today.getTime() + i * 86400000)),
          ),
        ).reduce((a, b) => a + b, 0),
      );
      return [
        {
          product_id: p.id,
          name: p.name,
          predicted_units: units,
          stock: p.stock,
          restock_units: Math.max(0, units + p.low_stock_threshold - p.stock),
        },
      ];
    });
  return {
    source,
    model_version: model.version,
    training_days: synthetic ? 112 : days,
    horizon_days: 7,
    validation_mae: errors.length
      ? errors.reduce((a, b) => a + b, 0) / errors.length
      : null,
    results,
  };
}
