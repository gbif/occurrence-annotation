import type { AnnotationReport } from './annotationReport';
import type { AnnotationRule } from './downloadProcessor';

export interface MapPoint {
  lat: number;
  lng: number;
  recordIndex: number;
  gbifID?: string;
  annotations: string[];
  taxonKey?: string;
  ruleIds: number[];
}

export interface SpeciesHierarchy {
  scientificName: string;
  recordCount: number;
  genusKey?: number;
  familyKey?: number;
  orderKey?: number;
  classKey?: number;
  phylumKey?: number;
  kingdomKey?: number;
}

export interface FilteredMapData {
  speciesKeys: number[];
  relevantRules: AnnotationRule[];
  flaggedPoints: MapPoint[];
  passingPoints: MapPoint[];
  speciesInfo: Map<number, SpeciesHierarchy>;
}

/**
 * Filters species to include only those with species-level rule matches
 * (either species-only or species + higher-order), excluding higher-order-only matches.
 * Limits to top 50 species by record count.
 */
export function filterSpeciesForMap(
  report: AnnotationReport,
  rules: AnnotationRule[],
  annotatedRecords: any[]
): FilteredMapData {
  // Build map of ruleId -> rule for quick lookup
  const ruleMap = new Map<number, AnnotationRule>();
  rules.forEach(rule => {
    if (rule.id) {
      ruleMap.set(rule.id, rule);
    }
  });

  // Find rules that have species-level matches (check matchedRanks includes 'species')
  const speciesLevelRuleIds = new Set<number>();
  report.ruleMatches.forEach(match => {
    if (match.matchedRanks && match.matchedRanks.includes('species')) {
      speciesLevelRuleIds.add(match.ruleId);
    }
  });

  // Filter to rules with species-level matches
  const relevantMatches = report.ruleMatches.filter(match => 
    speciesLevelRuleIds.has(match.ruleId)
  );

  // Group by taxonKey and count records, also collect hierarchy info
  const speciesRecordCounts = new Map<number, number>();
  const speciesNames = new Map<number, string>();
  const speciesHierarchies = new Map<number, SpeciesHierarchy>();
  
  relevantMatches.forEach(match => {
    if (match.taxonKey) {
      const currentCount = speciesRecordCounts.get(match.taxonKey) || 0;
      speciesRecordCounts.set(match.taxonKey, currentCount + match.recordsMatched);
      
      // Try to get species name and hierarchy from first matching record
      if (!speciesNames.has(match.taxonKey) && match.recordIndices.length > 0) {
        const firstRecordIndex = match.recordIndices[0];
        const record = annotatedRecords[firstRecordIndex];
        if (record) {
          // Store species name
          if (record.scientificName) {
            speciesNames.set(match.taxonKey, record.scientificName);
          } else if (record.species) {
            speciesNames.set(match.taxonKey, record.species);
          }
          
          // Store hierarchy information
          const hierarchy: SpeciesHierarchy = {
            scientificName: record.scientificName || record.species || `Species ${match.taxonKey}`,
            recordCount: 0, // Will be updated later
          };
          
          // Add hierarchy keys if available
          if (record.genusKey) hierarchy.genusKey = parseInt(record.genusKey);
          if (record.familyKey) hierarchy.familyKey = parseInt(record.familyKey);
          if (record.orderKey) hierarchy.orderKey = parseInt(record.orderKey);
          if (record.classKey) hierarchy.classKey = parseInt(record.classKey);
          if (record.phylumKey) hierarchy.phylumKey = parseInt(record.phylumKey);
          if (record.kingdomKey) hierarchy.kingdomKey = parseInt(record.kingdomKey);
          
          speciesHierarchies.set(match.taxonKey, hierarchy);
        }
      }
    }
  });

  // Sort species by record count descending and take top 50
  const sortedSpecies = Array.from(speciesRecordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);
  
  const topSpeciesKeys = sortedSpecies.map(([key]) => key);
  const topSpeciesSet = new Set(topSpeciesKeys);

  // Build speciesInfo map with hierarchy information
  const speciesInfo = new Map<number, SpeciesHierarchy>();
  sortedSpecies.forEach(([key, count]) => {
    const hierarchy = speciesHierarchies.get(key);
    if (hierarchy) {
      speciesInfo.set(key, {
        ...hierarchy,
        recordCount: count
      });
    } else {
      // Fallback if no hierarchy found
      speciesInfo.set(key, {
        scientificName: speciesNames.get(key) || `Species ${key}`,
        recordCount: count
      });
    }
  });

  // Build set of ALL taxonomic keys (species + all hierarchical levels) for top species
  const allHierarchicalKeys = new Set<number>();
  sortedSpecies.forEach(([key]) => {
    allHierarchicalKeys.add(key); // Add species itself
    const hierarchy = speciesHierarchies.get(key);
    if (hierarchy) {
      if (hierarchy.genusKey) allHierarchicalKeys.add(hierarchy.genusKey);
      if (hierarchy.familyKey) allHierarchicalKeys.add(hierarchy.familyKey);
      if (hierarchy.orderKey) allHierarchicalKeys.add(hierarchy.orderKey);
      if (hierarchy.classKey) allHierarchicalKeys.add(hierarchy.classKey);
      if (hierarchy.phylumKey) allHierarchicalKeys.add(hierarchy.phylumKey);
      if (hierarchy.kingdomKey) allHierarchicalKeys.add(hierarchy.kingdomKey);
    }
  });

  // Filter rules to include both species-level AND higher taxonomic level rules
  const relevantRules = rules.filter(rule => 
    rule.taxonKey && allHierarchicalKeys.has(rule.taxonKey)
  );

  // Build record index to rule IDs mapping - include ALL matches for top species
  const recordToRulesMap = new Map<number, number[]>();
  report.ruleMatches.forEach(match => {
    // Include match if the record's taxonKey is one of our top species
    if (match.taxonKey && topSpeciesSet.has(match.taxonKey)) {
      match.recordIndices.forEach(idx => {
        const existing = recordToRulesMap.get(idx) || [];
        existing.push(match.ruleId);
        recordToRulesMap.set(idx, existing);
      });
    }
  });

  // Extract flagged points with coordinates
  const flaggedPoints: MapPoint[] = [];
  const passingPoints: MapPoint[] = [];

  annotatedRecords.forEach((record, index) => {
    const lat = record.decimalLatitude ? parseFloat(record.decimalLatitude) : null;
    const lng = record.decimalLongitude ? parseFloat(record.decimalLongitude) : null;
    
    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
      return; // Skip records without valid coordinates
    }

    const taxonKey = record.taxonKey ? parseInt(record.taxonKey) : undefined;
    
    // Only include records for top 50 species
    if (taxonKey && !topSpeciesSet.has(taxonKey)) {
      return;
    }

    const ruleIds = recordToRulesMap.get(index) || [];
    const annotations = record.annotations ? record.annotations.split(';').filter((a: string) => a) : [];

    const point: MapPoint = {
      lat,
      lng,
      recordIndex: index,
      gbifID: record.gbifID,
      annotations,
      taxonKey: record.taxonKey,
      ruleIds
    };

    if (annotations.length > 0) {
      flaggedPoints.push(point);
    } else {
      passingPoints.push(point);
    }
  });

  return {
    speciesKeys: topSpeciesKeys,
    relevantRules,
    flaggedPoints,
    passingPoints,
    speciesInfo
  };
}

/**
 * Selects points for display with intelligent sampling to avoid overwhelming the map.
 * Strategy:
 * - Flagged points: sample based on total count
 * - Passing points: always included, sample up to 50
 */
export function selectPointsForDisplay(
  flaggedPoints: MapPoint[],
  passingPoints: MapPoint[]
): { flaggedPoints: MapPoint[]; passingPoints: MapPoint[] } {
  let sampledFlagged: MapPoint[];
  
  if (flaggedPoints.length <= 200) {
    // Show all if reasonable amount
    sampledFlagged = flaggedPoints;
  } else if (flaggedPoints.length <= 500) {
    // Sample 200 evenly distributed
    sampledFlagged = sampleEvenly(flaggedPoints, 200);
  } else {
    // For large datasets, sample 100 per species (max)
    sampledFlagged = samplePerSpecies(flaggedPoints, 100);
  }

  // Always include passing points for context, sample per species to ensure representation
  let sampledPassing: MapPoint[] = [];
  if (passingPoints.length > 0) {
    // Sample up to 10 passing points per species for better distribution
    sampledPassing = samplePerSpecies(passingPoints, 10);
  }

  return {
    flaggedPoints: sampledFlagged,
    passingPoints: sampledPassing
  };
}

/**
 * Sample points evenly from the array
 */
function sampleEvenly<T>(array: T[], targetCount: number): T[] {
  if (array.length <= targetCount) {
    return array;
  }

  const step = array.length / targetCount;
  const sampled: T[] = [];
  
  for (let i = 0; i < targetCount; i++) {
    const index = Math.floor(i * step);
    sampled.push(array[index]);
  }
  
  return sampled;
}

/**
 * Sample points per species, limiting each species to maxPerSpecies
 */
function samplePerSpecies(points: MapPoint[], maxPerSpecies: number): MapPoint[] {
  // Group by taxonKey
  const bySpecies = new Map<string | undefined, MapPoint[]>();
  
  points.forEach(point => {
    const key = point.taxonKey;
    const existing = bySpecies.get(key) || [];
    existing.push(point);
    bySpecies.set(key, existing);
  });

  // Sample from each species
  const sampled: MapPoint[] = [];
  bySpecies.forEach((speciesPoints) => {
    if (speciesPoints.length <= maxPerSpecies) {
      sampled.push(...speciesPoints);
    } else {
      sampled.push(...sampleEvenly(speciesPoints, maxPerSpecies));
    }
  });

  return sampled;
}
