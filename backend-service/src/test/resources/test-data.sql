-- Test data for foreign key relationships
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
