-- Migration script to convert basis_of_record from VARCHAR to TEXT[]
-- This script handles the migration safely by preserving existing data

-- Step 1: Add a new temporary column
ALTER TABLE rule ADD COLUMN basis_of_record_new TEXT[];

-- Step 2: Migrate existing data (convert single values to single-element arrays)
UPDATE rule 
SET basis_of_record_new = CASE 
    WHEN basis_of_record IS NOT NULL AND basis_of_record != '' 
    THEN ARRAY[basis_of_record]::TEXT[]
    ELSE NULL
END;

-- Step 3: Drop the old column
ALTER TABLE rule DROP COLUMN basis_of_record;

-- Step 4: Rename the new column
ALTER TABLE rule RENAME COLUMN basis_of_record_new TO basis_of_record;

-- Optional: Add a comment to document the change
COMMENT ON COLUMN rule.basis_of_record IS 'Array of basis of record values, allowing multiple values per rule';