-- Store subscriptions in Argentina go through Mercado Pago (preapproval, in
-- pesos); abroad they stay on PayPal. Same subscriptions/payments/shipments
-- tables: provider says which, provider_subscription_id holds the
-- preapproval id and provider_plan_id "mp:<plan>" (lib/mp-subscriptions.ts).
-- Each monthly charge is recorded with its provider, like PayPal's.
create or replace function public.record_subscription_payment(
  p_provider text, p_payment_id text, p_subscription_provider_id text, p_amount numeric, p_fee numeric, p_currency text
) returns boolean language plpgsql security definer set search_path = public as $$
declare local_subscription public.subscriptions%rowtype;
declare local_payment_id uuid;
begin
  select * into local_subscription from public.subscriptions
  where provider = p_provider and provider_subscription_id = p_subscription_provider_id;
  if not found then raise exception 'subscription not found: % %', p_provider, p_subscription_provider_id; end if;
  insert into public.payments (provider, provider_payment_id, kind, subscription_id, amount, fee, currency)
  values (p_provider, p_payment_id, 'subscription', local_subscription.id, p_amount, p_fee, p_currency)
  on conflict (provider_payment_id) do nothing returning id into local_payment_id;
  if local_payment_id is not null then
    insert into public.shipments (payment_id, shipping_address) values (local_payment_id, local_subscription.shipping_address);
  end if;
  update public.subscriptions set status = 'active', updated_at = now() where id = local_subscription.id;
  return local_payment_id is not null;
end;
$$;

revoke all on function public.record_subscription_payment(text, text, text, numeric, numeric, text) from public;
grant execute on function public.record_subscription_payment(text, text, text, numeric, numeric, text) to service_role;

notify pgrst, 'reload schema';
