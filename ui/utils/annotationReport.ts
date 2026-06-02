export interface AnnotationMatch {
  recordIndex: number;
  ruleId: number;
  annotation: string;
  taxonKey?: number;
  matchedSpatially: boolean;
  matchedTaxonomy: boolean;
  matchedRank?: string; // The taxonomic rank that matched (species, genus, family, etc.)
  matchedBasisOfRecord: boolean;
  matchedDatasetKey: boolean;
  matchedYear: boolean;
}

export interface RuleMatchSummary {
  ruleId: number;
  annotation: string;
  taxonKey?: number;
  datasetKey?: string;
  recordsMatched: number;
  recordIndices: number[];
  matchedRanks?: string[]; // Taxonomic ranks at which this rule matched (species, genus, family, etc.)
}

export interface AnnotationReport {
  totalRecords: number;
  recordsFlagged: number;
  recordsClean: number;
  percentFlagged: number;
  percentClean: number;
  ruleMatches: RuleMatchSummary[];
  annotationCounts: Record<string, number>;
  processingTime: number;
}

/**
 * Generate annotation report from matches
 */
export function generateReport(
  totalRecords: number,
  matches: AnnotationMatch[],
  processingTimeMs: number
): AnnotationReport {
  // Group matches by rule
  const ruleMatchesMap = new Map<number, RuleMatchSummary>();
  const ruleRanksMap = new Map<number, Set<string>>(); // Track unique ranks per rule
  const annotationCountsMap = new Map<string, number>();
  const flaggedRecordIndices = new Set<number>();
  
  matches.forEach(match => {
    // Track which records are flagged
    flaggedRecordIndices.add(match.recordIndex);
    
    // Group by rule
    if (!ruleMatchesMap.has(match.ruleId)) {
      ruleMatchesMap.set(match.ruleId, {
        ruleId: match.ruleId,
        annotation: match.annotation,
        taxonKey: match.taxonKey,
        datasetKey: undefined,
        recordsMatched: 0,
        recordIndices: [],
        matchedRanks: [],
      });
      ruleRanksMap.set(match.ruleId, new Set<string>());
    }
    
    const ruleSummary = ruleMatchesMap.get(match.ruleId)!;
    ruleSummary.recordsMatched++;
    ruleSummary.recordIndices.push(match.recordIndex);
    
    // Track matched rank
    if (match.matchedRank) {
      ruleRanksMap.get(match.ruleId)!.add(match.matchedRank);
    }
    
    // Count by annotation type
    const currentCount = annotationCountsMap.get(match.annotation) || 0;
    annotationCountsMap.set(match.annotation, currentCount + 1);
  });
  
  // Convert rank sets to arrays
  ruleMatchesMap.forEach((summary, ruleId) => {
    const ranks = ruleRanksMap.get(ruleId);
    if (ranks && ranks.size > 0) {
      summary.matchedRanks = Array.from(ranks);
    }
  });
  
  const recordsFlagged = flaggedRecordIndices.size;
  const recordsClean = totalRecords - recordsFlagged;
  
  return {
    totalRecords,
    recordsFlagged,
    recordsClean,
    percentFlagged: totalRecords > 0 ? (recordsFlagged / totalRecords) * 100 : 0,
    percentClean: totalRecords > 0 ? (recordsClean / totalRecords) * 100 : 0,
    ruleMatches: Array.from(ruleMatchesMap.values()).sort((a, b) => b.recordsMatched - a.recordsMatched),
    annotationCounts: Object.fromEntries(annotationCountsMap),
    processingTime: processingTimeMs,
  };
}

/**
 * Format report as human-readable text
 */
export function formatReportText(report: AnnotationReport): string {
  const lines: string[] = [];
  
  lines.push('=== GBIF Download Annotation Report ===');
  lines.push('');
  lines.push(`Total Records: ${report.totalRecords.toLocaleString()}`);
  lines.push(`Records Flagged: ${report.recordsFlagged.toLocaleString()} (${report.percentFlagged.toFixed(2)}%)`);
  lines.push(`Records Clean: ${report.recordsClean.toLocaleString()} (${report.percentClean.toFixed(2)}%)`);
  lines.push(`Processing Time: ${(report.processingTime / 1000).toFixed(2)}s`);
  lines.push('');
  
  if (Object.keys(report.annotationCounts).length > 0) {
    lines.push('Annotations by Type:');
    Object.entries(report.annotationCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([annotation, count]) => {
        lines.push(`  ${annotation}: ${count.toLocaleString()}`);
      });
    lines.push('');
  }
  
  if (report.ruleMatches.length > 0) {
    lines.push('Rules Applied:');
    report.ruleMatches.forEach((rule, index) => {
      lines.push(
        `  ${index + 1}. Rule ${rule.ruleId} (${rule.annotation}): ` +
        `${rule.recordsMatched.toLocaleString()} records`
      );
      if (rule.taxonKey) {
        lines.push(`     TaxonKey: ${rule.taxonKey}`);
      }
    });
  }
  
  return lines.join('\n');
}

/**
 * Export report as JSON string
 */
export function exportReportJSON(report: AnnotationReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Create a summary message for UI display
 */
export function createSummaryMessage(report: AnnotationReport): string {
  const flaggedPercent = report.percentFlagged.toFixed(1);
  const cleanPercent = report.percentClean.toFixed(1);
  
  if (report.recordsFlagged === 0) {
    return `All ${report.totalRecords.toLocaleString()} records are clean. No annotations applied.`;
  }
  
  return (
    `Processed ${report.totalRecords.toLocaleString()} records. ` +
    `${report.recordsFlagged.toLocaleString()} (${flaggedPercent}%) flagged, ` +
    `${report.recordsClean.toLocaleString()} (${cleanPercent}%) clean. ` +
    `Applied ${report.ruleMatches.length} rule${report.ruleMatches.length !== 1 ? 's' : ''}.`
  );
}

/**
 * Generate visual bar chart representation (text-based)
 */
export function generateBarChart(report: AnnotationReport, width: number = 50): string {
  const flaggedWidth = Math.round((report.percentFlagged / 100) * width);
  const cleanWidth = width - flaggedWidth;
  
  const flaggedBar = '█'.repeat(Math.max(0, flaggedWidth));
  const cleanBar = '█'.repeat(Math.max(0, cleanWidth));
  
  return `[${flaggedBar}${cleanBar}] ${report.percentFlagged.toFixed(1)}% flagged`;
}
