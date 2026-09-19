-- Diagnostic that intentionally failed once (see the "DIAGNOSTIC
-- legacy_submissions grants=..." error in this migration's first CI run) to
-- print the real grants/RLS state for legacy_submissions into the log —
-- confirmed authenticated already has full CRUD and RLS is on, ruling out a
-- missing-grant explanation for the "permission denied" error reported on
-- the service-role-backed photo batch fetch. Neutralized to a no-op so the
-- migration history stays clean instead of failing forever.
select 1;
