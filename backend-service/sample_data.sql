-- Sample data for testing year range functionality

-- First, insert a project
INSERT INTO project (name, description, members, created, created_by) 
VALUES ('Test Project', 'A project for testing year range functionality', ARRAY['testuser'], NOW(), 'testuser');

-- Insert a ruleset
INSERT INTO ruleset (project_id, name, description, members, created, created_by) 
VALUES (1, 'Test Ruleset', 'A ruleset for testing year ranges', ARRAY['testuser'], NOW(), 'testuser');

-- Insert rules with various year ranges
INSERT INTO rule (taxon_key, dataset_key, geometry, annotation, basis_of_record, year_range, ruleset_id, project_id, created, created_by) 
VALUES 
    -- Rule with specific year range
    (2435098, 'test-dataset-1', 'POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))', 'NATIVE', 'PRESERVED_SPECIMEN', '1800,1900', 1, 1, NOW(), 'testuser'),
    
    -- Rule with open-ended year range (from year onwards)
    (2435099, 'test-dataset-2', 'POLYGON((10 10, 10 11, 11 11, 11 10, 10 10))', 'INTRODUCED', 'HUMAN_OBSERVATION', '2000,*', 1, 1, NOW(), 'testuser'),
    
    -- Rule with open-ended year range (up to year)
    (2435100, 'test-dataset-3', 'POLYGON((20 20, 20 21, 21 21, 21 20, 20 20))', 'FORMER', 'FOSSIL_SPECIMEN', '*,1950', 1, 1, NOW(), 'testuser'),
    
    -- Rule with no year range restriction
    (2435101, 'test-dataset-4', 'POLYGON((30 30, 30 31, 31 31, 31 30, 30 30))', 'SUSPICIOUS', 'MACHINE_OBSERVATION', NULL, 1, 1, NOW(), 'testuser'),
    
    -- Rule with recent year range
    (2435102, 'test-dataset-5', 'POLYGON((40 40, 40 41, 41 41, 41 40, 40 40))', 'MANAGED', 'LIVING_SPECIMEN', '2020,2025', 1, 1, NOW(), 'testuser');

-- Add some comments to the rules
INSERT INTO comment (rule_id, comment, created, created_by)
VALUES 
    (1, 'This rule covers the Victorian era specimens', NOW(), 'testuser'),
    (2, 'Covers the digital age observations', NOW(), 'testuser'),
    (3, 'Important for paleontological studies', NOW(), 'testuser'),
    (4, 'General machine observation rule', NOW(), 'testuser'),
    (5, 'COVID-era specimen collection', NOW(), 'testuser');