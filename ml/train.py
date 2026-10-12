"""Reproducible weekday/trend ridge regression. Synthetic data never enters POS tables.
Optional real input: --input daily.csv (SKU,Date,Quantity), --source real.
Input must include zero-sales days; output is a versioned JSON model artifact.
"""
import argparse
import csv
import json
import math
import random
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SKUS = ['COLA-330', 'WATER-500', 'COFFEE', 'BREAD', 'PANDESAL', 'COOKIES', 'CHIPS', 'NOODLES', 'MILK-1L', 'SOAP', 'RICE-1KG', 'CRACKERS']


def features(day, weekday):
    return [1.0, day / 56] + [float(weekday == i) for i in range(6)]


def fit(rows):
    size = 8
    matrix = [[0.0] * (size + 1) for _ in range(size)]
    for day, weekday, quantity in rows:
        x = features(day, weekday)
        for i in range(size):
            for j in range(size):
                matrix[i][j] += x[i] * x[j]
            matrix[i][size] += x[i] * quantity
    for i in range(size):
        matrix[i][i] += 0.01
    for i in range(size):
        pivot = max(range(i, size), key=lambda j: abs(matrix[j][i]))
        matrix[i], matrix[pivot] = matrix[pivot], matrix[i]
        divisor = matrix[i][i]
        matrix[i] = [value / divisor for value in matrix[i]]
        for j in range(size):
            if j != i:
                factor = matrix[j][i]
                matrix[j] = [a - factor * b for a, b in zip(matrix[j], matrix[i])]
    return [matrix[i][size] for i in range(size)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path)
    parser.add_argument('--source', choices=['synthetic', 'real'], default='synthetic')
    parser.add_argument('--output', type=Path, default=ROOT / 'artifacts' / 'demand-v1.json')
    args = parser.parse_args()
    if args.source == 'real' and args.input is None:
        parser.error('--source real requires --input')
    dataset = []
    if args.input:
        with args.input.open(encoding='utf-8-sig', newline='') as handle:
            dataset = list(csv.DictReader(handle))
    else:
        rng = random.Random(42)
        start = date(2025, 1, 6)
        for index, sku in enumerate(SKUS):
            for day in range(112):
                current = start + timedelta(days=day)
                demand = 2 + index % 5 + day * .015 + (2 if current.weekday() >= 5 else 0)
                quantity = max(0, round(demand + rng.gauss(0, 1)))
                dataset.append({'SKU': sku, 'Date': current.isoformat(), 'Quantity': quantity})
        (ROOT / 'data').mkdir(exist_ok=True)
        with (ROOT / 'data' / 'synthetic_daily.csv').open('w', newline='', encoding='utf-8') as handle:
            writer = csv.DictWriter(handle, fieldnames=['SKU', 'Date', 'Quantity'])
            writer.writeheader()
            writer.writerows(dataset)
    models = {}
    all_errors = []
    for sku in sorted({row['SKU'] for row in dataset}):
        records = sorted([row for row in dataset if row['SKU'] == sku], key=lambda row: row['Date'])
        if len(records) < 56:
            raise ValueError(f'{sku}: at least 56 complete daily observations required')
        start = date.fromisoformat(records[0]['Date'])
        rows = []
        for i, row in enumerate(records):
            current = date.fromisoformat(row['Date'])
            quantity = float(row['Quantity'])
            if current != start + timedelta(days=i) or not math.isfinite(quantity) or quantity < 0:
                raise ValueError(f'{sku}: dates must be continuous and quantities finite/non-negative')
            rows.append((i, current.weekday(), quantity))
        split = len(rows) - 14
        validation = fit(rows[:split])
        errors = [abs(max(0, sum(a*b for a, b in zip(validation, features(day, weekday)))) - qty) for day, weekday, qty in rows[split:]]
        all_errors.extend(errors)
        models[sku] = {'coefficients': fit(rows), 'training_days': len(rows), 'validation_mae': round(sum(errors)/len(errors), 4), 'start_date': start.isoformat()}
    artifact = {'version': 'weekday-ridge-v1', 'source': args.source, 'seed': 42 if args.source == 'synthetic' else None, 'feature_names': ['intercept', 'day/56', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], 'validation_mae': round(sum(all_errors)/len(all_errors), 4), 'models': models}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(artifact, indent=2) + '\n', encoding='utf-8')
    if args.source == 'synthetic':
        destination = ROOT.parent / 'src' / 'ml' / 'model.json'
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(artifact, indent=2) + '\n', encoding='utf-8')
    print(f'{args.source}: {len(dataset)} observations; holdout MAE {artifact["validation_mae"]}; {args.output}')


if __name__ == '__main__':
    main()
