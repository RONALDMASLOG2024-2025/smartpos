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
-- PRODUCT_VALUES
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
