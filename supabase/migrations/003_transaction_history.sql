-- Apply after 001 and 002. Manager imports feed forecasting without stock deductions.
begin;
create table public.sales_history (
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),
 receipt text not null check(length(trim(receipt)) between 1 and 80),sold_at timestamptz not null,
 product_id uuid not null,sku text not null,product_name text not null,
 quantity integer not null check(quantity between 1 and 1000000),
 unit_price_cents integer not null check(unit_price_cents between 0 and 100000000),
 line_total_cents bigint not null check(line_total_cents=quantity::bigint*unit_price_cents and line_total_cents<=100000000000),
 source text not null check(source in ('real','synthetic')),
 created_at timestamptz not null default now(),unique(store_id,receipt,sku),
 foreign key(store_id,product_id) references public.products(store_id,id)
);
create index on public.sales_history(store_id,source,sold_at);
alter table public.sales_history enable row level security;
create policy history_read on public.sales_history for select to authenticated using(public.manager_for(store_id));
revoke all on public.sales_history from anon,authenticated;
grant select on public.sales_history to authenticated;

create function public.import_sales_history(p_rows jsonb,p_filename text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.accounts; group_row record; existing jsonb; added integer:=0; skipped integer:=0; count_receipts integer:=0; affected integer;
begin
 a:=public.require_account(true);
 if p_rows is null or jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'History must be an array'; end if;
 if jsonb_array_length(p_rows) not between 1 and 10000 then raise exception 'History requires 1 to 10000 item rows'; end if;
 if p_filename is null or length(trim(p_filename)) not between 1 and 200 then raise exception 'A filename of 1 to 200 characters is required'; end if;
 -- Validate all input before any receipt is stored. Casts also reject malformed numbers/dates.
 if exists(select 1 from jsonb_array_elements(p_rows) e where
  jsonb_typeof(e) is distinct from 'object'
  or coalesce(e->>'quantity','') !~ '^[0-9]+$'
  or coalesce(e->>'unit_price_cents','') !~ '^[0-9]+$'
  or coalesce(e->>'sold_at','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?(Z|[+-][0-9]{2}:[0-9]{2})$') then
  raise exception 'Invalid historical item fields';
 end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) as r(receipt text,sold_at timestamptz,sku text,quantity numeric,unit_price_cents numeric,source text)
  where receipt is null or length(trim(receipt)) not between 1 and 80 or sold_at is null or sold_at>now()
  or sku is null or length(trim(sku)) not between 1 and 64
  or quantity is null or quantity not between 1 and 1000000
  or unit_price_cents is null or unit_price_cents not between 0 and 100000000
  or quantity*unit_price_cents>100000000000 or source is null or source not in ('real','synthetic')) then
  raise exception 'Invalid historical quantity, price, timestamp or source';
 end if;
 if (select count(distinct r.source) from jsonb_to_recordset(p_rows) as r(source text))<>1 then raise exception 'Use one source per history file'; end if;
 if (select count(distinct (trim(r.receipt),upper(trim(r.sku)))) from jsonb_to_recordset(p_rows) as r(receipt text,sku text))<>jsonb_array_length(p_rows) then
  raise exception 'Duplicate SKU within a receipt';
 end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) as r(receipt text,sold_at timestamptz) group by trim(receipt) having count(distinct sold_at)<>1) then
  raise exception 'Receipt timestamps must match';
 end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) as r(sku text) where not exists(select 1 from public.products p where p.store_id=a.store_id and p.sku=upper(trim(r.sku)))) then
  raise exception 'Unknown SKU in this workspace. Add the product first';
 end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) as r(receipt text) join public.transactions t on t.store_id=a.store_id and (t.id::text=trim(r.receipt) or t.request_id::text=trim(r.receipt))) then
  raise exception 'A receipt already exists as a live checkout';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(a.store_id::text || ':history-import',0));
 for group_row in
  select trim(r.receipt) receipt,jsonb_agg(jsonb_build_object('sku',upper(trim(r.sku)),'sold_at',r.sold_at,'quantity',r.quantity,'unit_price_cents',r.unit_price_cents,'source',r.source) order by upper(trim(r.sku))) payload
  from jsonb_to_recordset(p_rows) as r(receipt text,sold_at timestamptz,sku text,quantity integer,unit_price_cents integer,source text)
  group by trim(r.receipt) order by trim(r.receipt)
 loop
  select jsonb_agg(jsonb_build_object('sku',h.sku,'sold_at',h.sold_at,'quantity',h.quantity,'unit_price_cents',h.unit_price_cents,'source',h.source) order by h.sku)
   into existing from public.sales_history h where h.store_id=a.store_id and h.receipt=group_row.receipt;
  if existing is not null then
   if existing<>group_row.payload then raise exception 'Receipt % already exists with different data. History is immutable',group_row.receipt; end if;
   skipped:=skipped+jsonb_array_length(group_row.payload);
   continue;
  end if;
  insert into public.sales_history(store_id,receipt,sold_at,product_id,sku,product_name,quantity,unit_price_cents,line_total_cents,source)
  select a.store_id,group_row.receipt,r.sold_at,p.id,p.sku,p.name,r.quantity,r.unit_price_cents,r.quantity::bigint*r.unit_price_cents,r.source
  from jsonb_to_recordset(group_row.payload) as r(sku text,sold_at timestamptz,quantity integer,unit_price_cents integer,source text)
  join public.products p on p.store_id=a.store_id and p.sku=r.sku;
  get diagnostics affected=row_count;
  added:=added+affected;count_receipts:=count_receipts+1;
 end loop;
 if added>0 then
  insert into public.import_runs(store_id,actor_id,filename,row_count,result)
  values(a.store_id,a.id,trim(p_filename),added,'history - ' || (p_rows->0->>'source'));
 end if;
 return jsonb_build_object('added',added,'skipped',skipped,'receipts',count_receipts);
end $$;

create function public.remove_synthetic_history() returns integer
language plpgsql security definer set search_path='' as $$
declare a public.accounts; removed integer;
begin
 a:=public.require_account(true);
 perform pg_advisory_xact_lock(hashtextextended(a.store_id::text || ':history-import',0));
 delete from public.sales_history where store_id=a.store_id and source='synthetic';
 get diagnostics removed=row_count;
 return removed;
end $$;
revoke all on function public.import_sales_history(jsonb,text),public.remove_synthetic_history() from public,anon;
grant execute on function public.import_sales_history(jsonb,text),public.remove_synthetic_history() to authenticated;
notify pgrst,'reload schema';
commit;
