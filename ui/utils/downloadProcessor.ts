import { testPointInPolygon, validateCoordinates } from './spatialMatcher';
import type { OccurrenceRecord } from './fileHandler';
import type { AnnotationMatch } from './annotationReport';

export interface AnnotationRule {
  id: number;
  taxonKey: number;
  datasetKey: string | null;
  geometry: string; // WKT format
  annotation: string;
  basisOfRecord?: string[] | null;
  basisOfRecordNegated?: boolean | null;
  yearRange?: string | null;
  rulesetId: number | null;
  projectId: number | null;
  deleted: string | null;
}

export interface ProcessingProgress {
  stage: string;
  current: number;
  total: number;
  percent: number;
}

/**
 * Check if a year value falls within a year range string
 * Range format: "startYear,endYear" or "startYear,*" (open-ended)
 */
function isYearInRange(year: number, yearRange: string): boolean {
  const [startStr, endStr] = yearRange.split(',').map(s => s.trim());
  const startYear = parseInt(startStr, 10);
  
  if (isNaN(startYear)) {
    return true; // Invalid range, accept all
  }
  
  if (year < startYear) {
    return false;
  }
  
  if (endStr === '*') {
    return true; // Open-ended range
  }
  
  const endYear = parseInt(endStr, 10);
  if (isNaN(endYear)) {
    return true; // Invalid end, accept all after start
  }
  
  return year <= endYear;
}

/**
 * Test if a record matches a rule's basis of record filter
 */
function matchesBasisOfRecordFilter(
  recordBor: string | undefined,
  ruleBor: string[] | null | undefined,
  negated: boolean | null | undefined
): boolean {
  // If rule has no basis of record filter, accept all
  if (!ruleBor || ruleBor.length === 0) {
    return true;
  }
  
  // If record has no basis of record value
  if (!recordBor) {
    // If negated, this means "not in list" which could be true for undefined
    // If not negated, this means "in list" which is false for undefined
    return !!negated;
  }
  
  const isInList = ruleBor.includes(recordBor);
  
  // Apply negation
  if (negated) {
    return !isInList; // Match if NOT in list
  } else {
    return isInList; // Match if IN list
  }
}

/**
 * Test if a record matches a rule's dataset key filter
 */
function matchesDatasetKeyFilter(
  recordDatasetKey: string | undefined,
  ruleDatasetKey: string | null
): boolean {
  // If rule has no dataset key filter, accept all
  if (!ruleDatasetKey) {
    return true;
  }
  
  // Exact match required
  return recordDatasetKey === ruleDatasetKey;
}

/**
 * Test if a record matches a rule's year range filter
 */
function matchesYearRangeFilter(
  recordYear: string | undefined,
  ruleYearRange: string | null | undefined
): boolean {
  // If rule has no year range filter, accept all
  if (!ruleYearRange) {
    return true;
  }
  
  // If record has no year
  if (!recordYear) {
    return false;
  }
  
  const year = parseInt(recordYear, 10);
  if (isNaN(year)) {
    return false;
  }
  
  return isYearInRange(year, ruleYearRange);
}

/**
 * Test if a record's taxonomy matches a rule's taxon key
 * @param includeHigherOrder If true, checks all ranks; if false, only checks taxonKey/speciesKey
 * @returns Object with matched boolean and the rank that matched (if any)
 */
function matchesTaxonomy(
  record: OccurrenceRecord,
  ruleTaxonKey: number,
  includeHigherOrder: boolean = true
): { matched: boolean; rank?: string } {
  // Define which fields to check based on includeHigherOrder
  const taxonomicFields = includeHigherOrder
    ? ['taxonKey', 'speciesKey', 'genusKey', 'familyKey', 'orderKey', 'classKey', 'phylumKey', 'kingdomKey']
    : ['taxonKey', 'speciesKey']; // Only species-level when higher-order is disabled
  
  for (const field of taxonomicFields) {
    const value = record[field];
    if (value && parseInt(value, 10) === ruleTaxonKey) {
      // Convert field name to display rank
      const rankMap: Record<string, string> = {
        'taxonKey': 'species',
        'speciesKey': 'species',
        'genusKey': 'genus',
        'familyKey': 'family',
        'orderKey': 'order',
        'classKey': 'class',
        'phylumKey': 'phylum',
        'kingdomKey': 'kingdom'
      };
      return { matched: true, rank: rankMap[field] || field };
    }
  }
  
  return { matched: false };
}

/**
 * Apply a single rule to a single record
 */
function applyRuleToRecord(
  record: OccurrenceRecord,
  recordIndex: number,
  rule: AnnotationRule,
  includeHigherOrder: boolean = true
): AnnotationMatch | null {
  // Extract coordinates
  const latStr = record.decimalLatitude;
  const lonStr = record.decimalLongitude;
  
  if (!latStr || !lonStr) {
    return null; // No coordinates
  }
  
  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  
  if (!validateCoordinates(lat, lon)) {
    return null; // Invalid coordinates
  }
  
  // Step 1: Test spatial containment
  const matchedSpatially = testPointInPolygon(lat, lon, rule.geometry);
  
  if (!matchedSpatially) {
    return null; // Not in polygon, no need to check other filters
  }
  
  // Step 2: Test taxonomic match
  const taxonomyResult = matchesTaxonomy(record, rule.taxonKey, includeHigherOrder);
  
  if (!taxonomyResult.matched) {
    return null; // Doesn't match taxonomy
  }
  
  // Step 3: Test basis of record filter (if applicable)
  const matchedBasisOfRecord = matchesBasisOfRecordFilter(
    record.basisOfRecord,
    rule.basisOfRecord,
    rule.basisOfRecordNegated
  );
  
  if (!matchedBasisOfRecord) {
    return null; // Doesn't match basis of record filter
  }
  
  // Step 4: Test dataset key filter (if applicable)
  const matchedDatasetKey = matchesDatasetKeyFilter(
    record.datasetKey,
    rule.datasetKey
  );
  
  if (!matchedDatasetKey) {
    return null; // Doesn't match dataset key filter
  }
  
  // Step 5: Test year range filter (if applicable)
  const matchedYear = matchesYearRangeFilter(record.year, rule.yearRange);
  
  if (!matchedYear) {
    return null; // Doesn't match year range filter
  }
  
  // All filters passed - record matches this rule
  return {
    recordIndex,
    ruleId: rule.id,
    annotation: rule.annotation,
    taxonKey: rule.taxonKey,
    matchedSpatially,
    matchedTaxonomy: taxonomyResult.matched,
    matchedRank: taxonomyResult.rank,
    matchedBasisOfRecord,
    matchedDatasetKey,
    matchedYear,
  };
}

/**
 * Process download records against annotation rules
 */
export async function processDownload(
  records: OccurrenceRecord[],
  rules: AnnotationRule[],
  onProgress?: (progress: ProcessingProgress) => void,
  batchSize: number = 1000,
  includeHigherOrder: boolean = true
): Promise<AnnotationMatch[]> {
  const matches: AnnotationMatch[] = [];
  const totalRecords = records.length;
  const totalRules = rules.length;
  
  // Filter out deleted rules
  const activeRules = rules.filter(rule => !rule.deleted);
  
  if (activeRules.length === 0) {
    onProgress?.({
      stage: 'No active rules to apply',
      current: 0,
      total: 0,
      percent: 100,
    });
    return matches;
  }
  
  onProgress?.({
    stage: `Applying ${activeRules.length} rules to ${totalRecords.toLocaleString()} records`,
    current: 0,
    total: totalRecords,
    percent: 0,
  });
  
  // Process records in batches to avoid blocking UI
  for (let batchStart = 0; batchStart < totalRecords; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, totalRecords);
    const batch = records.slice(batchStart, batchEnd);
    
    // Process each record in the batch
    batch.forEach((record, batchIndex) => {
      const recordIndex = batchStart + batchIndex;
      
      // Apply all rules to this record
      activeRules.forEach(rule => {
        const match = applyRuleToRecord(record, recordIndex, rule, includeHigherOrder);
        if (match) {
          matches.push(match);
        }
      });
    });
    
    // Update progress
    const percent = ((batchEnd / totalRecords) * 100);
    onProgress?.({
      stage: `Processing records`,
      current: batchEnd,
      total: totalRecords,
      percent,
    });
    
    // Allow UI to update between batches
    if (batchEnd < totalRecords) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return matches;
}

/**
 * Annotate records with their matched rules
 * Returns a new array with an 'annotations' column added
 */
export function annotateRecords(
  records: OccurrenceRecord[],
  matches: AnnotationMatch[]
): Array<OccurrenceRecord & { annotations: string }> {
  // Group matches by record index
  const matchesByRecord = new Map<number, string[]>();
  
  matches.forEach(match => {
    if (!matchesByRecord.has(match.recordIndex)) {
      matchesByRecord.set(match.recordIndex, []);
    }
    // Avoid duplicate annotations for same record
    const annotations = matchesByRecord.get(match.recordIndex)!;
    if (!annotations.includes(match.annotation)) {
      annotations.push(match.annotation);
    }
  });
  
  // Add annotations column to all records
  return records.map((record, index) => {
    const annotations = matchesByRecord.get(index) || [];
    return {
      ...record,
      annotations: annotations.join(';') || '', // Semicolon-delimited list, empty string if no annotations
    };
  });
}

/**
 * Filter records to create a "clean" dataset by excluding records based on annotations and conflict mode.
 * 
 * Conflict Mode Options:
 * - 'exclude_any' (default): Remove if ANY annotation is in exclude list
 * - 'keep_conflicting': Keep records with both excluded and non-excluded annotations
 * - 'exclude_all': Remove only if ALL annotations are in exclude list
 * 
 * Examples with excludeAnnotations = ['SUSPICIOUS'] and mode = 'exclude_any':
 * - A record with annotation "SUSPICIOUS" -> EXCLUDED
 * - A record with annotation "NATIVE" -> KEPT
 * - A record with annotation "INTRODUCED" -> KEPT  
 * - A record with annotations "SUSPICIOUS;NATIVE" -> EXCLUDED (has SUSPICIOUS)
 * - A record with no annotations -> KEPT
 * 
 * Examples with excludeAnnotations = ['SUSPICIOUS'] and mode = 'keep_conflicting':
 * - A record with annotation "SUSPICIOUS" -> EXCLUDED (only has excluded)
 * - A record with annotation "NATIVE" -> KEPT (only has non-excluded)
 * - A record with annotations "SUSPICIOUS;NATIVE" -> KEPT (has both)
 * 
 * Examples with excludeAnnotations = ['SUSPICIOUS'] and mode = 'exclude_all':
 * - A record with annotation "SUSPICIOUS" -> EXCLUDED (all are excluded)
 * - A record with annotation "NATIVE" -> KEPT (has non-excluded)
 * - A record with annotations "SUSPICIOUS;NATIVE" -> KEPT (not all are excluded)
 * 
 * @param records Array of occurrence records to filter
 * @param matches Array of annotation matches for the records
 * @param excludeAnnotations List of annotation types to exclude (default: ['SUSPICIOUS'])
 * @param mode Conflict handling mode (default: 'exclude_any')
 * @returns Filtered array based on the specified conflict mode
 */
export function filterCleanRecords(
  records: OccurrenceRecord[],
  matches: AnnotationMatch[],
  excludeAnnotations: string[] = ['SUSPICIOUS'],
  mode: 'exclude_any' | 'keep_conflicting' | 'exclude_all' = 'exclude_any'
): OccurrenceRecord[] {
  // Group matches by record index
  const matchesByRecord = new Map<number, AnnotationMatch[]>();
  matches.forEach(match => {
    const existing = matchesByRecord.get(match.recordIndex) || [];
    existing.push(match);
    matchesByRecord.set(match.recordIndex, existing);
  });

  return records.filter((_, index) => {
    const recordMatches = matchesByRecord.get(index);
    
    // If no matches, keep the record
    if (!recordMatches || recordMatches.length === 0) {
      return true;
    }

    const annotations = recordMatches.map(m => m.annotation);
    const hasExcluded = annotations.some(ann => excludeAnnotations.includes(ann));
    const hasNonExcluded = annotations.some(ann => !excludeAnnotations.includes(ann));
    const allExcluded = annotations.every(ann => excludeAnnotations.includes(ann));

    switch (mode) {
      case 'exclude_any':
        // Remove if ANY annotation is in exclude list
        return !hasExcluded;
      
      case 'keep_conflicting':
        // Keep if record has both excluded and non-excluded annotations
        // Remove if it ONLY has excluded or ONLY has non-excluded
        if (hasExcluded && hasNonExcluded) {
          return true; // Conflicting - keep it
        }
        return !hasExcluded; // Non-conflicting - exclude if has excluded annotation
      
      case 'exclude_all':
        // Remove only if ALL annotations are in exclude list
        return !allExcluded;
      
      default:
        return !hasExcluded; // Default to exclude_any behavior
    }
  });
}
