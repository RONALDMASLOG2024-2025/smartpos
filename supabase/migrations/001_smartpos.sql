-- Run once in a new Supabase project. All application mutations go through guarded RPCs.
create type public.app_role as enum ('manager','cashier');
create type public.product_status as enum ('active','archived');
create type public.payment_method as enum ('cash','card','ewallet');
create table public.stores (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 100),
 currency text not null default 'PHP' check(currency='PHP'), timezone text not null default 'Asia/Manila' check(timezone='Asia/Manila'),
 receipt_note text not null default 'Thank you for shopping with us!' check(length(receipt_note)<=500), created_at timestamptz not null default now()
);
create table public.accounts (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
 user_id uuid unique references auth.users(id), email text not null unique check(email=lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 name text not null check(length(trim(name)) between 1 and 100), role public.app_role not null, active boolean not null default true,
 created_at timestamptz not null default now(), unique(store_id,id)
);
create table public.categories (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id), name text not null check(length(trim(name)) between 1 and 80),
 created_at timestamptz not null default now(), unique(store_id,name), unique(store_id,id)
);
create table public.products (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id), sku text not null check(length(trim(sku)) between 1 and 64 and sku=upper(trim(sku))),
 name text not null check(length(trim(name)) between 1 and 120), category_id uuid, description text not null default '' check(length(description)<=1000),
 price_cents integer not null check(price_cents between 0 and 100000000), cost_cents integer not null default 0 check(cost_cents between 0 and 100000000),
 stock integer not null default 0 check(stock between 0 and 1000000), low_stock_threshold integer not null default 10 check(low_stock_threshold between 0 and 1000000),
 status public.product_status not null default 'active', image_path text check(image_path is null or image_path like store_id::text || '/%'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(store_id,sku), unique(store_id,id), foreign key(store_id,category_id) references public.categories(store_id,id)
);
create table public.transactions (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id), cashier_id uuid not null,
 cashier_name text not null, store_name text not null, receipt_note text not null, request_id uuid not null, request_payload jsonb not null,
 subtotal_cents bigint not null check(subtotal_cents between 0 and 100000000000), discount_cents bigint not null check(discount_cents>=0 and discount_cents<=subtotal_cents),
 total_cents bigint not null check(total_cents=subtotal_cents-discount_cents), payment_cents bigint not null check(payment_cents>=total_cents and payment_cents<=100000000000),
 change_cents bigint not null check(change_cents=payment_cents-total_cents), method public.payment_method not null,
 created_at timestamptz not null default now(), unique(store_id,id), unique(store_id,request_id),
 foreign key(store_id,cashier_id) references public.accounts(store_id,id)
);
create table public.transaction_items (
 id uuid primary key default gen_random_uuid(), store_id uuid not null, transaction_id uuid not null, product_id uuid not null,
 sku text not null, product_name text not null, quantity integer not null check(quantity between 1 and 1000000),
 unit_price_cents integer not null check(unit_price_cents>=0), line_total_cents bigint not null check(line_total_cents=quantity::bigint*unit_price_cents),
 foreign key(store_id,transaction_id) references public.transactions(store_id,id), foreign key(store_id,product_id) references public.products(store_id,id)
);
create table public.stock_movements (
 id uuid primary key default gen_random_uuid(), store_id uuid not null, product_id uuid not null, actor_id uuid not null,
 delta integer not null, balance integer not null check(balance>=0), reason text not null check(length(trim(reason)) between 1 and 200), transaction_id uuid,
 created_at timestamptz not null default now(), foreign key(store_id,product_id) references public.products(store_id,id),
 foreign key(store_id,actor_id) references public.accounts(store_id,id), foreign key(store_id,transaction_id) references public.transactions(store_id,id)
);
create table public.import_runs (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id), actor_id uuid not null,
 filename text not null, row_count integer not null check(row_count>0), result text not null default 'completed', created_at timestamptz not null default now(),
 foreign key(store_id,actor_id) references public.accounts(store_id,id)
);
create table public.forecast_runs (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id), source text not null check(source in ('synthetic','real','insufficient')),
 model_version text not null, results jsonb not null, created_at timestamptz not null default now()
);
create index on public.accounts(store_id,active);
create index on public.products(store_id,status,category_id);
create index on public.transactions(store_id,created_at desc);
create index on public.transactions(cashier_id,created_at desc);
create index on public.transaction_items(transaction_id);
create index on public.transaction_items(store_id,product_id);
create index on public.stock_movements(store_id,created_at desc);

create function public.current_account() returns public.accounts language sql stable security definer set search_path='' as $$
 select a from public.accounts a where a.user_id=auth.uid() and a.active
$$;
create function public.manager_for(s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((public.current_account()).store_id=s and (public.current_account()).role='manager',false)
$$;
create function public.require_account(manager_only boolean default false) returns public.accounts language plpgsql stable security definer set search_path='' as $$
declare a public.accounts; begin
 a:=public.current_account();
 if a.id is null or (manager_only and a.role<>'manager') then raise exception 'Access denied' using errcode='42501'; end if;
 return a;
end $$;

-- Link only an explicitly provisioned, verified Google identity. Email is taken from auth, never from the client.
create function public.claim_account() returns public.accounts language plpgsql security definer set search_path='' as $$
declare a public.accounts; mail text; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select lower(u.email) into mail from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null
 and exists(select 1 from auth.identities i where i.user_id=u.id and i.provider='google');
 if mail is null then raise exception 'A verified Google account is required'; end if;
 select * into a from public.accounts where email=mail and active for update;
 if a.id is null then raise exception 'Your Google account has not been approved by a Manager' using errcode='42501'; end if;
 if a.user_id is not null and a.user_id<>auth.uid() then raise exception 'Account is already linked'; end if;
 update public.accounts set user_id=auth.uid() where id=a.id returning * into a;
 return a;
end $$;

create function public.catalogue() returns table(id uuid,store_id uuid,sku text,name text,category_id uuid,description text,price_cents integer,stock integer,low_stock_threshold integer,status public.product_status,image_path text,created_at timestamptz,updated_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare a public.accounts; begin a:=public.require_account();
 return query select p.id,p.store_id,p.sku,p.name,p.category_id,p.description,p.price_cents,p.stock,p.low_stock_threshold,p.status,p.image_path,p.created_at,p.updated_at
 from public.products p where p.store_id=a.store_id and p.status='active';
end $$;

create function public.checkout(p_request_id uuid,p_items jsonb,p_payment bigint,p_method public.payment_method,p_discount bigint default 0) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.accounts; p public.products; s public.stores; item jsonb; qty integer; sub bigint:=0; sale uuid; payload jsonb; old public.transactions;
begin
 a:=public.require_account();
 payload:=jsonb_build_object('items',p_items,'payment',p_payment,'method',p_method,'discount',p_discount);
 if p_request_id is null then raise exception 'Request ID required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(a.store_id::text||p_request_id::text,0));
 select * into old from public.transactions where store_id=a.store_id and request_id=p_request_id;
 if old.id is not null then
  if old.cashier_id<>a.id or old.request_payload<>payload then raise exception 'Request ID already used for a different sale'; end if;
  return old.id;
 end if;
 if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Cart must be an array'; end if;
 if jsonb_array_length(p_items) not between 1 and 200 then raise exception 'Cart must contain 1 to 200 items'; end if;
 if (select count(distinct x->>'product_id') from jsonb_array_elements(p_items) x)<>jsonb_array_length(p_items) then raise exception 'Duplicate cart product'; end if;
 if p_discount is null or p_discount<0 or (p_discount>0 and a.role<>'manager') then raise exception 'Discount requires Manager permission'; end if;
 if p_payment is null or p_payment<0 or p_payment>100000000000 or p_method is null then raise exception 'Invalid payment'; end if;
 -- Ordered row locks prevent overselling and deadlocks between overlapping baskets.
 perform 1 from public.products where store_id=a.store_id and id in(select (x->>'product_id')::uuid from jsonb_array_elements(p_items) x) order by id for update;
 for item in select * from jsonb_array_elements(p_items) loop
  if coalesce(item->>'quantity','') !~ '^[0-9]+$' or coalesce(item->>'expected_price_cents','') !~ '^[0-9]+$' then raise exception 'Invalid cart quantity or price'; end if;
  qty:=(item->>'quantity')::integer;
  select * into p from public.products where store_id=a.store_id and id=(item->>'product_id')::uuid;
  if p.id is null or p.status<>'active' or qty not between 1 and 1000000 or p.stock<qty then raise exception 'Product unavailable or insufficient stock'; end if;
  if p.price_cents<>(item->>'expected_price_cents')::integer then raise exception 'Price changed. Refresh and review the cart'; end if;
  sub:=sub+qty::bigint*p.price_cents;
 end loop;
 if sub>100000000000 then raise exception 'Sale amount exceeds the supported limit'; end if;
 if p_discount>sub or p_payment<sub-p_discount then raise exception 'Invalid discount or insufficient payment'; end if;
 if p_method<>'cash' and p_payment<>sub-p_discount then raise exception 'Non-cash payment must equal total'; end if;
 select * into s from public.stores where id=a.store_id;
 insert into public.transactions(store_id,cashier_id,cashier_name,store_name,receipt_note,request_id,request_payload,subtotal_cents,discount_cents,total_cents,payment_cents,change_cents,method)
 values(a.store_id,a.id,a.name,s.name,s.receipt_note,p_request_id,payload,sub,p_discount,sub-p_discount,p_payment,p_payment-(sub-p_discount),p_method) returning id into sale;
 for item in select * from jsonb_array_elements(p_items) loop
  qty:=(item->>'quantity')::integer;
  update public.products set stock=stock-qty,updated_at=now() where store_id=a.store_id and id=(item->>'product_id')::uuid returning * into p;
  insert into public.transaction_items(store_id,transaction_id,product_id,sku,product_name,quantity,unit_price_cents,line_total_cents)
  values(a.store_id,sale,p.id,p.sku,p.name,qty,p.price_cents,qty::bigint*p.price_cents);
  insert into public.stock_movements(store_id,product_id,actor_id,delta,balance,reason,transaction_id) values(a.store_id,p.id,a.id,-qty,p.stock,'Sale',sale);
 end loop;
 return sale;
end $$;

create function public.save_product(p_data jsonb,p_expected_stock integer default null) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.accounts; prev public.products; saved public.products; pid uuid; stock_value integer; begin
 a:=public.require_account(true); pid:=nullif(p_data->>'id','')::uuid; stock_value:=(p_data->>'stock')::integer;
 if stock_value is null or coalesce(p_data->>'stock','') !~ '^[0-9]+$' then raise exception 'Invalid stock'; end if;
 if pid is not null then
  select * into prev from public.products where store_id=a.store_id and id=pid for update;
  if prev.id is null then raise exception 'Product not found'; end if;
  if p_expected_stock is null or prev.stock<>p_expected_stock then raise exception 'Stock changed. Refresh before saving'; end if;
  update public.products set sku=upper(trim(p_data->>'sku')),name=trim(p_data->>'name'),category_id=nullif(p_data->>'category_id','')::uuid,
  description=coalesce(p_data->>'description',''),price_cents=(p_data->>'price_cents')::integer,cost_cents=(p_data->>'cost_cents')::integer,
  stock=stock_value,low_stock_threshold=(p_data->>'low_stock_threshold')::integer,status=(p_data->>'status')::public.product_status,
  image_path=nullif(p_data->>'image_path',''),updated_at=now() where id=pid returning * into saved;
 else
  insert into public.products(store_id,sku,name,category_id,description,price_cents,cost_cents,stock,low_stock_threshold,status,image_path)
  values(a.store_id,upper(trim(p_data->>'sku')),trim(p_data->>'name'),nullif(p_data->>'category_id','')::uuid,coalesce(p_data->>'description',''),
  (p_data->>'price_cents')::integer,(p_data->>'cost_cents')::integer,stock_value,(p_data->>'low_stock_threshold')::integer,(p_data->>'status')::public.product_status,nullif(p_data->>'image_path','')) returning * into saved;
 end if;
 if saved.stock<>coalesce(prev.stock,0) then
  insert into public.stock_movements(store_id,product_id,actor_id,delta,balance,reason) values(a.store_id,saved.id,a.id,saved.stock-coalesce(prev.stock,0),saved.stock,case when pid is null then 'Opening stock' else 'Manager adjustment' end);
 end if; return saved.id;
end $$;

create function public.adjust_stock(p_id uuid,p_stock integer,p_expected integer,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare a public.accounts; p public.products; begin a:=public.require_account(true);
 select * into p from public.products where store_id=a.store_id and id=p_id for update;
 if p.id is null or p_expected is null or p.stock<>p_expected then raise exception 'Stock changed or product unavailable. Refresh'; end if;
 if p_stock is null or p_stock not between 0 and 1000000 then raise exception 'Invalid stock'; end if;
 update public.products set stock=p_stock,updated_at=now() where id=p_id;
 insert into public.stock_movements(store_id,product_id,actor_id,delta,balance,reason) values(a.store_id,p_id,a.id,p_stock-p.stock,p_stock,trim(p_reason));
end $$;

create function public.import_products(p_rows jsonb,p_filename text) returns integer language plpgsql security definer set search_path='' as $$
declare a public.accounts; row jsonb; cid uuid; pid uuid; old_stock integer; cnt integer:=0; begin a:=public.require_account(true);
 if p_rows is null or jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Import must be an array'; end if;
 if jsonb_array_length(p_rows) not between 1 and 2000 then raise exception 'Import requires 1 to 2000 rows'; end if;
 if (select count(distinct upper(trim(x->>'sku'))) from jsonb_array_elements(p_rows) x)<>jsonb_array_length(p_rows) then raise exception 'Duplicate SKU in import'; end if;
 for row in select * from jsonb_array_elements(p_rows) order by upper(trim(value->>'sku')) loop
  cid:=null; pid:=null; old_stock:=null;
  if length(trim(coalesce(row->>'category','')))>0 then
   insert into public.categories(store_id,name) values(a.store_id,trim(row->>'category')) on conflict(store_id,name) do nothing;
   select id into cid from public.categories where store_id=a.store_id and name=trim(row->>'category');
  end if;
  select id,stock into pid,old_stock from public.products where store_id=a.store_id and sku=upper(trim(row->>'sku')) for update;
  if pid is not null and (row->>'expected_stock')::integer is distinct from old_stock then raise exception 'Stock changed since import preview'; end if;
  if pid is null and row->>'expected_stock' is not null then raise exception 'Product changed since import preview'; end if;
  perform public.save_product(row || jsonb_build_object('id',pid,'category_id',cid,'image_path',(select image_path from public.products where id=pid)),old_stock);
  cnt:=cnt+1;
 end loop;
 insert into public.import_runs(store_id,actor_id,filename,row_count) values(a.store_id,a.id,left(p_filename,200),cnt);
 return cnt;
end $$;

create function public.manage_cashier(p_email text,p_name text,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare a public.accounts; other public.accounts; mail text:=lower(trim(p_email)); begin a:=public.require_account(true);
 select * into other from public.accounts where email=mail for update;
 if other.id is not null and (other.store_id<>a.store_id or other.role<>'cashier') then raise exception 'Account belongs to another workspace or is a Manager'; end if;
 insert into public.accounts(store_id,email,name,role,active) values(a.store_id,mail,trim(p_name),'cashier',p_active)
 on conflict(email) do update set name=excluded.name,active=excluded.active
 where public.accounts.store_id=a.store_id and public.accounts.role='cashier';
 if not found then raise exception 'Account belongs to another workspace or is a Manager'; end if;
end $$;

-- Explicit provisioning is run only by the project owner in SQL Editor.
create function public.provision_manager(p_email text,p_name text,p_store_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid; begin
 insert into public.stores(name) values(trim(p_store_name)) returning id into sid;
 insert into public.accounts(store_id,email,name,role) values(sid,lower(trim(p_email)),trim(p_name),'manager'); return sid;
end $$;

alter table public.stores enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.import_runs enable row level security;
alter table public.forecast_runs enable row level security;
create policy store_read on public.stores for select to authenticated using(id=(public.current_account()).store_id);
create policy store_write on public.stores for update to authenticated using(public.manager_for(id)) with check(public.manager_for(id));
create policy account_read on public.accounts for select to authenticated using(user_id=auth.uid() or public.manager_for(store_id));
create policy category_read on public.categories for select to authenticated using(store_id=(public.current_account()).store_id);
create policy category_insert on public.categories for insert to authenticated with check(public.manager_for(store_id));
create policy category_update on public.categories for update to authenticated using(public.manager_for(store_id)) with check(public.manager_for(store_id));
create policy product_read on public.products for select to authenticated using(public.manager_for(store_id));
create policy sale_read on public.transactions for select to authenticated using(store_id=(public.current_account()).store_id and (public.manager_for(store_id) or cashier_id=(public.current_account()).id));
create policy item_read on public.transaction_items for select to authenticated using(exists(select 1 from public.transactions t where t.id=transaction_id and t.store_id=transaction_items.store_id));
create policy stock_read on public.stock_movements for select to authenticated using(public.manager_for(store_id));
create policy import_read on public.import_runs for select to authenticated using(public.manager_for(store_id));
create policy forecast_read on public.forecast_runs for select to authenticated using(public.manager_for(store_id));
create policy forecast_insert on public.forecast_runs for insert to authenticated with check(public.manager_for(store_id));

revoke all on public.stores,public.accounts,public.categories,public.products,public.transactions,public.transaction_items,public.stock_movements,public.import_runs,public.forecast_runs from anon,authenticated;
grant select on public.stores,public.accounts,public.categories,public.products,public.transactions,public.transaction_items,public.stock_movements,public.import_runs,public.forecast_runs to authenticated;
grant update(name,receipt_note) on public.stores to authenticated;
grant insert(store_id,name),update(name) on public.categories to authenticated;
grant insert(store_id,source,model_version,results) on public.forecast_runs to authenticated;
revoke all on function public.provision_manager(text,text,text) from public,anon,authenticated;
revoke all on function public.require_account(boolean) from public,anon,authenticated;
revoke all on function public.current_account(),public.manager_for(uuid),public.claim_account(),public.catalogue(),public.checkout(uuid,jsonb,bigint,public.payment_method,bigint),public.save_product(jsonb,integer),public.adjust_stock(uuid,integer,integer,text),public.import_products(jsonb,text),public.manage_cashier(text,text,boolean) from public,anon;
grant execute on function public.current_account(),public.manager_for(uuid),public.claim_account(),public.catalogue(),public.checkout(uuid,jsonb,bigint,public.payment_method,bigint),public.save_product(jsonb,integer),public.adjust_stock(uuid,integer,integer,text),public.import_products(jsonb,text),public.manage_cashier(text,text,boolean) to authenticated;

-- Private product image bucket. Tenant folder controls read, Manager membership controls writes.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('product-images','product-images',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy image_read on storage.objects for select to authenticated using(bucket_id='product-images' and (storage.foldername(name))[1]=(public.current_account()).store_id::text);
create policy image_insert on storage.objects for insert to authenticated with check(bucket_id='product-images' and (storage.foldername(name))[1]=(public.current_account()).store_id::text and public.manager_for((public.current_account()).store_id));
create policy image_delete on storage.objects for delete to authenticated using(bucket_id='product-images' and (storage.foldername(name))[1]=(public.current_account()).store_id::text and public.manager_for((public.current_account()).store_id));
