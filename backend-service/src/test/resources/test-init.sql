-- Database schema for occurrence annotation service
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
    taxon_key INT,
    dataset_key TEXT,
    geometry TEXT NOT NULL,
    annotation TEXT NOT NULL,
    basis_of_record TEXT[],
    basis_of_record_negated BOOLEAN DEFAULT FALSE,
    year_range TEXT,
    ruleset_id INT NOT NULL REFERENCES ruleset ON DELETE CASCADE DEFERRABLE,
    project_id INT REFERENCES project ON DELETE CASCADE DEFERRABLE,
    supported_by TEXT[] NOT NULL DEFAULT '{}',
    contested_by TEXT[] NOT NULL DEFAULT '{}',
    created TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    created_by TEXT NOT NULL,
    modified TIMESTAMP WITHOUT TIME ZONE,
    modified_by TEXT,
    deleted TIMESTAMP WITHOUT TIME ZONE,
    deleted_by TEXT
);

CREATE INDEX rule_taxon_key_idx ON rule (taxon_key);
CREATE INDEX rule_dataset_key_idx ON rule (dataset_key);
CREATE INDEX rule_ruleset_id_idx ON rule (ruleset_id);
CREATE INDEX rule_project_id_idx ON rule (project_id);

CREATE TABLE comment (
    id SERIAL NOT NULL PRIMARY KEY,
    rule_id INT NOT NULL REFERENCES rule ON DELETE CASCADE DEFERRABLE,
    comment TEXT NOT NULL,
    created TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    created_by TEXT NOT NULL,
    deleted TIMESTAMP WITHOUT TIME ZONE,
    deleted_by TEXT
);

-- Test data for integration tests
-- These records must exist for tests to insert rules successfully

-- Insert a test project
INSERT INTO project (id, name, description, members, created, created_by)
VALUES (1, 'Test Project', 'Test project for integration tests', ARRAY['test-user'], NOW(), 'test-user');

-- Insert a test ruleset (references project)
INSERT INTO ruleset (id, project_id, name, description, members, created, created_by)
VALUES (1, 1, 'Test Ruleset', 'Test ruleset for integration tests', ARRAY['test-user'], NOW(), 'test-user');

-- Reset sequences to avoid conflicts
SELECT setval('project_id_seq', 1, true);
SELECT setval('ruleset_id_seq', 1, true);
