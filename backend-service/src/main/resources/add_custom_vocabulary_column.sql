-- Migration: Add custom_vocabulary column to project table
-- This column stores project-specific annotation vocabulary as JSONB

ALTER TABLE project ADD COLUMN IF NOT EXISTS custom_vocabulary JSONB;

-- Add comment for documentation
COMMENT ON COLUMN project.custom_vocabulary IS 'Custom annotation vocabulary terms stored as JSONB array. Each term has: term, description, color, locked fields.';
