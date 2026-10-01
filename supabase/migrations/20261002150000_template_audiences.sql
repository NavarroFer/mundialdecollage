-- Templates catalogued by who they're for (/admin/plantillas): artistas,
-- hinchas, interesados, clientes, jurado, todos — several per template. The
-- automatic (system) ones come tagged; the admin tags the rest. Values match
-- lib/template-audiences.ts.
alter table public.templates
  add column if not exists audiences text[] not null default '{}';

alter table public.templates drop constraint if exists templates_audiences_check;
alter table public.templates add constraint templates_audiences_check
  check (audiences <@ array['artistas', 'hinchas', 'interesados', 'clientes', 'jurado', 'todos']::text[]);

-- The automatic templates that already exist. New ones get their tags from
-- the code when they're first created (lib/system-templates.ts).
update public.templates set audiences = array['artistas'] where system_key in ('museo_hoy', 'novedades_obra', 'confirmar_datos', 'certificado') and audiences = '{}';
update public.templates set audiences = array['artistas', 'clientes'] where system_key = 'compra_obras' and audiences = '{}';
update public.templates set audiences = array['clientes'] where system_key in ('compra_revista', 'compra_suscripcion') and audiences = '{}';
update public.templates set audiences = array['hinchas'] where system_key = 'bienvenida_hincha' and audiences = '{}';
update public.templates set audiences = array['interesados', 'hinchas'] where system_key like 'cuenta_regresiva_%' and audiences = '{}';
update public.templates set audiences = array['jurado'] where system_key like 'jurado_%' and audiences = '{}';

notify pgrst, 'reload schema';
