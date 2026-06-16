-- Database initialization script for occurrence annotation service
-- Combines liquibase/schema.sql + all migrations for docker-entrypoint-initdb.d
-- This script is idempotent and can be run multiple times safely

-- Baseline schema (from liquibase/schema.sql)
DROP TABLE IF EXISTS comment;
DROP TABLE IF EXISTS rule;
DROP TABLE IF EXISTS ruleset;
DROP TABLE IF EXISTS project;

CREATE TABLE project (
    id SERIAL NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    members TEXT[] NOT NULL DEFAULT '{}',
    created TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    created_by TEXT NOT NULL,
    modified TIMESTAMP WITHOUT TIME ZONE,
    modified_by TEXT,
    deleted TIMESTAMP WITHOUT TIME ZONE,
    deleted_by TEXT
);

CREATE TABLE ruleset (
    id SERIAL NOT NULL PRIMARY KEY,
    project_id INT REFERENCES project ON DELETE CASCADE DEFERRABLE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    members TEXT[] NOT NULL DEFAULT '{}',
    created TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    created_by TEXT NOT NULL,
    modified TIMESTAMP WITHOUT TIME ZONE,
    modified_by TEXT,
    deleted TIMESTAMP WITHOUT TIME ZONE,
    deleted_by TEXT
);

CREATE TABLE rule (
    id SERIAL NOT NULL PRIMARY KEY,
    taxon_key VARCHAR(50),
    dataset_key TEXT,
    geometry TEXT NOT NULL,
    annotation TEXT NOT NULL,
    basis_of_record TEXT[],
    basis_of_record_negated BOOLEAN DEFAULT FALSE,
    year_range TEXT,
    ruleset_id INT REFERENCES ruleset ON DELETE CASCADE DEFERRABLE,
    project_id INT REFERENCES project ON DELETE CASCADE DEFERRABLE,
    supported_by TEXT[] NOT NULL DEFAULT '{}',
    contested_by TEXT[] NOT NULL DEFAULT '{}',
    created TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    created_by TEXT NOT NULL,
    deleted TIMESTAMP WITHOUT TIME ZONE,
    deleted_by TEXT
);

CREATE TABLE comment (
    id SERIAL NOT NULL PRIMARY KEY,
    rule_id INT REFERENCES rule ON DELETE CASCADE DEFERRABLE,
    comment TEXT,
    created TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    created_by TEXT NOT NULL,
    deleted TIMESTAMP WITHOUT TIME ZONE,
    deleted_by TEXT
);

-- Migration 002: Add custom vocabulary to project (JSONB)
ALTER TABLE project ADD COLUMN IF NOT EXISTS custom_vocabulary JSONB;
COMMENT ON COLUMN project.custom_vocabulary IS 'Custom annotation vocabulary terms stored as JSONB array. Each term has: term, description, color, locked fields.';

-- Migration 003: Add lookup indexes on rule table
CREATE INDEX IF NOT EXISTS rule_taxon_key_idx ON rule (taxon_key);
CREATE INDEX IF NOT EXISTS rule_dataset_key_idx ON rule (dataset_key);
CREATE INDEX IF NOT EXISTS rule_ruleset_id_idx ON rule (ruleset_id);
CREATE INDEX IF NOT EXISTS rule_project_id_idx ON rule (project_id);

-- Note: taxon_key is already VARCHAR(50) in the CREATE TABLE above (migration 004 applied inline)
