-- Applied by src/migrate.ts before the generated migrations run.
--
-- pg_trgm is required: it backs entity_name_norm_trgm_idx, which is the
-- blocking step for fuzzy name matching.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- PostGIS is optional today. Distances are computed in JS (core/match.ts), so
-- the only thing it buys us right now is the spatial index in 010. Missing it
-- must not stop the schema from applying to a plain Postgres.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS postgis;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'PostGIS not available - spatial index will be skipped.';
END
$$;
