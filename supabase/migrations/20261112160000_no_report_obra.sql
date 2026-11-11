-- An obra published in Comunidad is the artist's contest work. People can
-- report a souvenir or a free photo; they cannot report the obra, and three
-- reports cannot hide it.

create or replace function public.on_post_report()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  total integer;
  post_kind text;
begin
  select kind into post_kind from public.posts where id = new.post_id;
  if post_kind = 'artwork' then
    raise exception 'an obra cannot be reported' using errcode = 'P0001';
  end if;
  update public.posts set report_count = report_count + 1 where id = new.post_id
    returning report_count into total;
  if total >= 3 then
    update public.posts set status = 'hidden' where id = new.post_id and status = 'published';
  end if;
  perform public.notify_admins('post_reported',
    jsonb_build_object('postId', new.post_id, 'reports', total), 'post_reported:' || new.post_id);
  return new;
end;
$$;

notify pgrst, 'reload schema';
