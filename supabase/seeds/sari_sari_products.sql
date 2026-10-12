-- Paste this entire file into Supabase SQL Editor and run as the project owner.
-- Synthetic prices, costs and opening stock: edit these values for your actual shop.
-- Targets the EXISTING store named Sari Sari Store. Creates no stores or accounts.
-- Re-running skips existing SKUs and preserves their prices, stock and images.
-- Upload the JPGs to product-images/<store UUID>/starter/, then re-run to link photos.
begin;

create temporary table sari_sari_catalog (
 sku text primary key, name text, category text, price_cents integer,
 cost_cents integer, stock integer, low_stock_threshold integer, image_file text
) on commit drop;

insert into sari_sari_catalog values
 ('SSS-001', 'Regular White Rice - 1 kg', 'Rice & Pantry', 5500, 4700, 50, 10, 'rice.jpg'),
 ('SSS-002', 'Premium White Rice - 1 kg', 'Rice & Pantry', 6500, 5600, 35, 8, 'rice.jpg'),
 ('SSS-003', 'White Sugar - 250 g', 'Rice & Pantry', 2500, 1900, 40, 10, 'sugar.jpg'),
 ('SSS-004', 'White Sugar - 1 kg', 'Rice & Pantry', 9000, 7500, 20, 5, 'sugar.jpg'),
 ('SSS-005', 'Iodized Salt - 250 g', 'Rice & Pantry', 1200, 800, 30, 8, 'salt.jpg'),
 ('SSS-006', 'Chicken Egg - 1 piece', 'Eggs & Bread', 900, 700, 90, 20, 'eggs.jpg'),
 ('SSS-007', 'Cooking Oil - 250 mL', 'Condiments', 3500, 2700, 30, 8, 'oil.jpg'),
 ('SSS-008', 'Cooking Oil - 1 L', 'Condiments', 12500, 10500, 15, 4, 'oil.jpg'),
 ('SSS-009', 'Instant Noodles Chicken - 55 g', 'Noodles & Canned Goods', 1200, 900, 60, 15, 'noodles.jpg'),
 ('SSS-010', 'Instant Noodles Beef - 55 g', 'Noodles & Canned Goods', 1200, 900, 48, 12, 'noodles.jpg'),
 ('SSS-011', 'Instant Pancit Canton Chili - 60 g', 'Noodles & Canned Goods', 1600, 1200, 48, 12, 'noodles.jpg'),
 ('SSS-012', 'Sardines in Tomato Sauce - 155 g', 'Noodles & Canned Goods', 2500, 2000, 36, 10, 'sardines.jpg'),
 ('SSS-013', 'Spicy Sardines - 155 g', 'Noodles & Canned Goods', 2700, 2200, 24, 6, 'sardines.jpg'),
 ('SSS-014', 'Instant Coffee - 2 g sachet', 'Coffee & Milk', 500, 300, 100, 25, 'coffee.jpg'),
 ('SSS-015', '3-in-1 Coffee - 20 g sachet', 'Coffee & Milk', 1000, 700, 100, 25, 'coffee.jpg'),
 ('SSS-016', 'Powdered Milk Drink - 33 g sachet', 'Coffee & Milk', 1500, 1100, 60, 15, 'milk.jpg'),
 ('SSS-017', 'Evaporated Milk - 150 mL', 'Coffee & Milk', 3000, 2400, 24, 6, 'milk.jpg'),
 ('SSS-018', 'Drinking Water - 500 mL', 'Beverages', 1500, 1000, 48, 12, 'water.jpg'),
 ('SSS-019', 'Drinking Water - 1 L', 'Beverages', 2500, 1800, 24, 6, 'water.jpg'),
 ('SSS-020', 'Cola Soft Drink - 250 mL', 'Beverages', 2000, 1400, 36, 10, 'cola.jpg'),
 ('SSS-021', 'Cola Soft Drink - 1.5 L', 'Beverages', 7500, 6200, 12, 4, 'cola.jpg'),
 ('SSS-022', 'Plain Crackers - 25 g pack', 'Snacks & Candy', 800, 500, 60, 15, 'biscuits.jpg'),
 ('SSS-023', 'Plain Crackers - 90 g pack', 'Snacks & Candy', 2500, 1900, 24, 6, 'biscuits.jpg'),
 ('SSS-024', 'Butter Biscuits - 30 g pack', 'Snacks & Candy', 1000, 700, 48, 12, 'biscuits.jpg'),
 ('SSS-025', 'Potato Chips Original - 25 g', 'Snacks & Candy', 1500, 1000, 40, 10, 'chips.jpg'),
 ('SSS-026', 'Potato Chips Cheese - 25 g', 'Snacks & Candy', 1500, 1000, 40, 10, 'chips.jpg'),
 ('SSS-027', 'Fruit Candy - 1 piece', 'Snacks & Candy', 200, 100, 200, 50, 'candy.jpg'),
 ('SSS-028', 'Fruit Candy - 20 piece pack', 'Snacks & Candy', 3000, 2000, 20, 5, 'candy.jpg'),
 ('SSS-029', 'Bath Soap - 90 g bar', 'Personal Care', 2500, 1900, 30, 8, 'soap.jpg'),
 ('SSS-030', 'Shampoo - 12 mL sachet', 'Personal Care', 800, 500, 100, 25, 'shampoo.jpg'),
 ('SSS-031', 'Shampoo - 180 mL bottle', 'Personal Care', 9500, 7500, 12, 4, 'shampoo.jpg'),
 ('SSS-032', 'Liquid Laundry Detergent - 250 mL', 'Household Cleaning', 3500, 2600, 24, 6, 'detergent.jpg'),
 ('SSS-033', 'Liquid Laundry Detergent - 500 mL', 'Household Cleaning', 6500, 5000, 18, 5, 'detergent.jpg'),
 ('SSS-034', 'Dishwashing Liquid - 250 mL', 'Household Cleaning', 3500, 2500, 24, 6, 'dishwashing.jpg'),
 ('SSS-035', 'Toothpaste - 24 g tube', 'Personal Care', 2500, 1800, 30, 8, 'toothpaste.jpg'),
 ('SSS-036', 'Toothpaste - 100 g tube', 'Personal Care', 6500, 5000, 18, 5, 'toothpaste.jpg'),
 ('SSS-037', 'Soy Sauce - 200 mL', 'Condiments', 2000, 1400, 24, 6, 'soy-sauce.jpg'),
 ('SSS-038', 'Soy Sauce - 500 mL', 'Condiments', 4000, 3000, 18, 5, 'soy-sauce.jpg'),
 ('SSS-039', 'Sliced Bread - 400 g loaf', 'Eggs & Bread', 5500, 4300, 15, 5, 'bread.jpg'),
 ('SSS-040', 'Bath Soap - 135 g bar', 'Personal Care', 3800, 2800, 24, 6, 'soap.jpg')
;

create temporary table sari_sari_import_result (
 store_id uuid, store_name text, storage_folder text,
 products_added integer, existing_skus_skipped integer, photos_linked integer
) on commit drop;

do $$
declare
 sid uuid;
 owner_id uuid;
 matches integer;
 row record;
 cid uuid;
 pid uuid;
 added integer := 0;
 linked integer := 0;
begin
 select count(*) into matches from public.stores
 where lower(trim(name)) = lower('Sari Sari Store');
 if matches <> 1 then
  raise exception 'Expected one existing store named Sari Sari Store; found %. Check the store name before importing', matches;
 end if;
 select id into sid from public.stores where lower(trim(name)) = lower('Sari Sari Store');
 perform pg_advisory_xact_lock(hashtextextended(sid::text || ':sari-sari-starter', 0));
 select count(*) into matches from public.accounts
 where store_id=sid and role='manager' and active and user_id is not null;
 if matches <> 1 then raise exception 'Expected one active signed-in Manager in this store; found %',matches; end if;
 select id into owner_id from public.accounts
 where store_id=sid and role='manager' and active and user_id is not null;

 for row in select * from sari_sari_catalog order by sku loop
  -- Only create a category when its new product is actually being inserted.
  if exists(select 1 from public.products where store_id=sid and sku=row.sku) then continue; end if;
  insert into public.categories(store_id,name) values(sid,row.category)
   on conflict(store_id,name) do nothing;
  select id into cid from public.categories where store_id=sid and name=row.category;
  pid := null;
  insert into public.products(store_id,sku,name,category_id,description,price_cents,
   cost_cents,stock,low_stock_threshold,status)
  values(sid,row.sku,row.name,cid,'Sold per unit or pack shown in the product name.',
   row.price_cents,row.cost_cents,row.stock,row.low_stock_threshold,'active')
  on conflict(store_id,sku) do nothing returning id into pid;
  if pid is not null then
   insert into public.stock_movements(store_id,product_id,actor_id,delta,balance,reason)
   values(sid,pid,owner_id,row.stock,row.stock,'Opening stock - synthetic sari-sari starter import');
   added := added + 1;
  end if;
 end loop;

 -- Link only actual uploaded objects, leaving existing product photos intact.
 update public.products p
 set image_path=sid::text || '/starter/' || c.image_file,updated_at=now()
 from sari_sari_catalog c
 where p.store_id=sid and p.sku=c.sku and p.image_path is null
 and exists(select 1 from storage.objects o where o.bucket_id='product-images'
  and o.name=sid::text || '/starter/' || c.image_file);
 get diagnostics linked = row_count;

 if added > 0 then
  insert into public.import_runs(store_id,actor_id,filename,row_count,result)
  values(sid,owner_id,'sari_sari_products.sql',added,'completed');
 end if;
 insert into sari_sari_import_result values(sid,'Sari Sari Store',sid::text || '/starter',
  added,(select count(*) from sari_sari_catalog)-added,linked);
end $$;

-- Copy storage_folder from this result when uploading the images in Storage.
select * from sari_sari_import_result;
commit;

-- Final SELECT also exposes the upload folder in editors showing only the last result.
select id as store_id,name as store_name,id::text || '/starter' as storage_folder
from public.stores where lower(trim(name))=lower('Sari Sari Store');
