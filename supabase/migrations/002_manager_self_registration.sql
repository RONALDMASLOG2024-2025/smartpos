-- Run after 001_smartpos.sql, including on projects that already have accounts.
-- New Google users may create their own store by explicitly choosing Manager.
begin;

drop function if exists public.claim_account();

create or replace function public.claim_account(p_role public.app_role default null)
returns public.accounts language plpgsql security definer set search_path='' as $$
declare
 a public.accounts;
 mail text;
 display_name text;
 sid uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;

 -- Serialize registration for this user, including duplicate OAuth callbacks.
 -- Identity and email come from Supabase Auth, never from the requested role.
 select lower(trim(u.email)),
  left(coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'),''),
                nullif(trim(u.raw_user_meta_data->>'name'),''),
                split_part(u.email,'@',1)),100)
 into mail,display_name
 from auth.users u
 where u.id=auth.uid() and u.email_confirmed_at is not null
 and exists(select 1 from auth.identities i where i.user_id=u.id and i.provider='google')
 for update of u;
 if mail is null then raise exception 'A verified Google account is required'; end if;

 select * into a from public.accounts
 where user_id=auth.uid() or email=mail for update;
 if a.id is not null then
  if not a.active then
   raise exception 'Your account has been disabled. Contact your store Manager' using errcode='42501';
  end if;
  if a.user_id is not null and a.user_id<>auth.uid() then raise exception 'Account is already linked'; end if;
  if p_role is not null and a.role<>p_role then
   raise exception 'This Google account is registered as a %. Choose % to sign in',initcap(a.role::text),initcap(a.role::text)
    using errcode='42501';
  end if;
  update public.accounts set user_id=auth.uid() where id=a.id returning * into a;
  return a;
 end if;

 if p_role is distinct from 'manager'::public.app_role then
  raise exception 'Your Google account has not been approved by a Manager. Ask your store Manager to add your email as a Cashier'
   using errcode='42501';
 end if;

 -- A Manager owns a new workspace; choosing a role grants no existing-store access.
 insert into public.stores(name) values('My store') returning id into sid;
 insert into public.accounts(store_id,user_id,email,name,role)
 values(sid,auth.uid(),mail,display_name,'manager') returning * into a;
 return a;
end $$;

revoke all on function public.claim_account(public.app_role) from public,anon;
grant execute on function public.claim_account(public.app_role) to authenticated;
notify pgrst, 'reload schema';
commit;
