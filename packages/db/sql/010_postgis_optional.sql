-- Applied by src/migrate.ts after the generated migrations.
-- Creates the spatial index only where PostGIS actually exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    CREATE INDEX IF NOT EXISTS entity_geom_idx
      ON entity USING gist ((ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography));
    RAISE NOTICE 'PostGIS spatial index ready.';
  END IF;
END
$$;
