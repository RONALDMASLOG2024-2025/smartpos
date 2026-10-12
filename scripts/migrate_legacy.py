"""Validate preserved legacy CSVs and generate an atomic, reviewable SQL migration.
Run: python scripts/migrate_legacy.py --store-id UUID --output legacy-import.sql
Run output in Supabase SQL Editor only against an empty catalogue/sales workspace.
No credentials, network requests, inventory deductions or automatic writes.
"""
import argparse
import csv
import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid5
from zoneinfo import ZoneInfo


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def amount(value):
    decimal = Decimal(value)
    if not decimal.is_finite() or decimal < 0 or decimal * 100 != (decimal * 100).to_integral_value():
        raise ValueError(f'Invalid monetary amount: {value}')
    return int(decimal * 100)


def integer(value):
    if not str(value).isdigit():
        raise ValueError(f'Invalid quantity: {value}')
    return int(value)


def generate(directory, store_id):
    namespace = UUID(store_id)
    uid = lambda key: str(uuid5(namespace, key))
    def read(name):
        with (directory / name).open(encoding='utf-8-sig', newline='') as handle:
            return list(csv.DictReader(handle))
    products = read('products.csv')
    sales = read('transactions.csv')
    items = read('transaction_items.csv')
    if len({p['product_id'] for p in products}) != len(products) or len({s['transaction_id'] for s in sales}) != len(sales):
        raise ValueError('Duplicate legacy product or transaction IDs')
    known = {p['product_id'] for p in products}
    for item in items:
        if item['transaction_id'] not in {s['transaction_id'] for s in sales}:
            raise ValueError('Orphan transaction item')
        if item['product_id'] not in known:
            products.append({'product_id': item['product_id'], 'product_name': item['product_name'], 'category': 'Legacy archived', 'price': item['unit_price'], 'stock_quantity': '0', 'archived': True})
            known.add(item['product_id'])
    sid = literal(store_id)
    output = ['-- Generated from preserved legacy CSVs. Review before executing.', 'begin;', f"do $$ begin if not exists(select 1 from public.stores where id={sid}) then raise exception 'Unknown store'; end if; if exists(select 1 from public.products where store_id={sid}) or exists(select 1 from public.transactions where store_id={sid}) then raise exception 'Migration requires an empty workspace'; end if; end $$;"]
    legacy_id = literal(uid('legacy-cashier'))
    output.append(f"insert into public.accounts(id,store_id,email,name,role,active) values({legacy_id},{sid},{literal('legacy-'+store_id+'@migration.invalid')},'Legacy (cashier unrecorded)','cashier',false);")
    categories = sorted({p['category'] for p in products})
    for category in categories:
        if not category.strip():
            raise ValueError('Empty legacy category')
        output.append(f"insert into public.categories(id,store_id,name) values({literal(uid('category:'+category))},{sid},{literal(category)});")
    for p in products:
        price, stock = amount(p['price']), integer(p['stock_quantity'])
        if not p['product_id'].strip() or not p['product_name'].strip() or price > 100000000 or stock > 1000000:
            raise ValueError('Invalid legacy product')
        output.append(f"insert into public.products(id,store_id,sku,name,category_id,price_cents,stock,status) values({literal(uid('product:'+p['product_id']))},{sid},{literal(p['product_id'].upper())},{literal(p['product_name'])},{literal(uid('category:'+p['category']))},{price},{stock},{literal('archived' if p.get('archived') else 'active')});")
    for sale in sales:
        basket = [i for i in items if i['transaction_id'] == sale['transaction_id']]
        if not basket:
            raise ValueError('Legacy sale has no items')
        total, paid, change = amount(sale['total']), amount(sale['payment']), amount(sale['change'])
        if total > 100000000000 or paid < total or paid-total != change or sum(amount(i['subtotal']) for i in basket) != total:
            raise ValueError('Legacy sale totals do not reconcile')
        timestamp = datetime.fromisoformat(sale['datetime']).replace(tzinfo=ZoneInfo('Asia/Manila')).isoformat()
        tx = literal(uid('sale:'+sale['transaction_id']))
        payload = literal(json.dumps({'source': 'legacy_csv', 'legacy_id': sale['transaction_id'], 'cashier': 'unrecorded'}))
        output.append(f"insert into public.transactions(id,store_id,cashier_id,cashier_name,store_name,receipt_note,request_id,request_payload,subtotal_cents,discount_cents,total_cents,payment_cents,change_cents,method,created_at) values({tx},{sid},{legacy_id},'Legacy (cashier unrecorded)','Legacy SmartPOS','Imported historical receipt; original cashier/store details were not recorded.',{tx},{payload}::jsonb,{total},0,{total},{paid},{change},'cash',{literal(timestamp)});")
        for index, item in enumerate(basket):
            qty, price, line = integer(item['quantity']), amount(item['unit_price']), amount(item['subtotal'])
            if qty < 1 or qty > 1000000 or price > 100000000 or qty*price != line:
                raise ValueError('Invalid legacy line total')
            output.append(f"insert into public.transaction_items(id,store_id,transaction_id,product_id,sku,product_name,quantity,unit_price_cents,line_total_cents) values({literal(uid('item:'+sale['transaction_id']+':'+str(index)))},{sid},{tx},{literal(uid('product:'+item['product_id']))},{literal(item['product_id'].upper())},{literal(item['product_name'])},{qty},{price},{line});")
    output.append('commit;')
    return '\n'.join(output) + '\n'


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--store-id', required=True)
    parser.add_argument('--directory', type=Path, default=Path(__file__).resolve().parents[1] / 'data')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    sql = generate(args.directory, args.store_id)
    args.output.write_text(sql, encoding='utf-8')
    print(f'Validated legacy products/sales/items; review {args.output}. No database changes applied.')
