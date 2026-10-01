-- /admin/tienda reads the store with the admin's own session: subscribers,
-- their payments and the shipments to send. Admins can also mark a
-- shipment as sent; every other write stays with the service role
-- (webhooks), so nothing here can mark a payment as paid.
create policy "customers: admin read" on public.customers for select using (public.is_admin());
create policy "subscriptions: admin read" on public.subscriptions for select using (public.is_admin());
create policy "payments: admin read" on public.payments for select using (public.is_admin());
create policy "orders: admin read" on public.orders for select using (public.is_admin());
create policy "shipments: admin read" on public.shipments for select using (public.is_admin());
create policy "shipments: admin update" on public.shipments for update using (public.is_admin()) with check (public.is_admin());

grant select on public.customers, public.subscriptions, public.payments, public.orders, public.shipments to authenticated;
grant update (status, carrier, tracking_code, shipped_at) on public.shipments to authenticated;

notify pgrst, 'reload schema';
