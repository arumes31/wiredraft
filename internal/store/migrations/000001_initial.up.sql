BEGIN;

CREATE TABLE IF NOT EXISTS topologies (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    organization text NOT NULL DEFAULT '',
    location text NOT NULL DEFAULT '',
    revision bigint NOT NULL CHECK (revision > 0),
    rack_count integer NOT NULL CHECK (rack_count >= 0),
    device_count integer NOT NULL CHECK (device_count >= 0),
    link_count integer NOT NULL CHECK (link_count >= 0),
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    document jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS topologies_updated_at_idx
    ON topologies (updated_at DESC);

CREATE INDEX IF NOT EXISTS topologies_organization_idx
    ON topologies (lower(organization));

CREATE TABLE IF NOT EXISTS auth_state (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    version integer NOT NULL,
    document jsonb NOT NULL,
    encryption_key bytea NOT NULL CHECK (octet_length(encryption_key) = 32),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
