BEGIN;

CREATE TABLE organizations (
    id uuid PRIMARY KEY,
    name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
    normalized_name text GENERATED ALWAYS AS (lower(btrim(name))) STORED,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT organizations_normalized_name_key UNIQUE (normalized_name),
    CONSTRAINT organizations_default_name_check
        CHECK (NOT is_default OR normalized_name = 'default')
);

CREATE UNIQUE INDEX organizations_one_default_idx
    ON organizations (is_default)
    WHERE is_default;

INSERT INTO organizations (id, name, is_default)
VALUES ('00000000-0000-4000-8000-000000000000', 'Default', true)
ON CONFLICT (normalized_name) DO NOTHING;

INSERT INTO organizations (id, name)
SELECT gen_random_uuid(), legacy.name
FROM (
    SELECT DISTINCT ON (lower(btrim(organization))) btrim(organization) AS name
    FROM topologies
    WHERE btrim(organization) <> ''
    ORDER BY lower(btrim(organization)), btrim(organization)
) AS legacy
ON CONFLICT (normalized_name) DO NOTHING;

ALTER TABLE topologies
    ADD COLUMN organization_id uuid;

UPDATE topologies AS topology
SET organization_id = organization.id
FROM organizations AS organization
WHERE organization.normalized_name = lower(btrim(topology.organization));

UPDATE topologies
SET organization_id = '00000000-0000-4000-8000-000000000000'
WHERE organization_id IS NULL;

ALTER TABLE topologies
    ALTER COLUMN organization_id SET NOT NULL,
    ADD CONSTRAINT topologies_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT;

CREATE INDEX topologies_organization_id_idx
    ON topologies (organization_id);

UPDATE topologies AS topology
SET organization = organization.name,
    document = jsonb_set(
        jsonb_set(
            topology.document,
            '{organizationId}',
            to_jsonb(organization.id::text),
            true
        ),
        '{organization}',
        to_jsonb(organization.name),
        true
    )
FROM organizations AS organization
WHERE organization.id = topology.organization_id;

COMMIT;
