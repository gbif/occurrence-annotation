import JSZip from 'jszip';
import Papa from 'papaparse';

export interface OccurrenceRecord {
  [key: string]: string | undefined;
  decimalLatitude?: string;
  decimalLongitude?: string;
  taxonKey?: string;
  kingdomKey?: string;
  phylumKey?: string;
  classKey?: string;
  orderKey?: string;
  familyKey?: string;
  genusKey?: string;
  speciesKey?: string;
  basisOfRecord?: string;
  datasetKey?: string;
  year?: string;
  gbifID?: string;
}

export interface ParsedDownload {
  records: OccurrenceRecord[];
  columns: string[];
  filename: string;
  recordCount: number;
  uniqueTaxonKeys: number[];
}

/**
 * Extract and parse GBIF download zip file
 */
export async function extractAndParseDownload(
  file: File,
  onProgress?: (stage: string, percent: number) => void
): Promise<ParsedDownload> {
  try {
    onProgress?.('Extracting zip file', 0);
    
    // Load zip file
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    onProgress?.('Extracting zip file', 30);
    
    // Find the occurrence file (CSV or TSV with same name as zip, minus .zip extension)
    const baseName = file.name.replace(/\.zip$/i, '');
    const possibleFiles = [
      `${baseName}.csv`,
      `${baseName}.tsv`,
      'occurrence.txt', // Default GBIF download name
      'occurrence.csv',
    ];
    
    let occurrenceFile: JSZip.JSZipObject | null = null;
    for (const fileName of possibleFiles) {
      occurrenceFile = zip.file(fileName);
      if (occurrenceFile) break;
    }
    
    // If not found, look for any .csv or .txt file
    if (!occurrenceFile) {
      const files = Object.keys(zip.files);
      const csvFile = files.find(f => f.endsWith('.csv') || f.endsWith('.txt') || f.endsWith('.tsv'));
      if (csvFile) {
        occurrenceFile = zip.file(csvFile);
      }
    }
    
    if (!occurrenceFile) {
      throw new Error('No occurrence file found in zip. Expected CSV or TSV file.');
    }
    
    onProgress?.('Reading occurrence file', 50);
    
    // Extract file content
    const content = await occurrenceFile.async('string');
    
    onProgress?.('Parsing CSV', 60);
    
    // Parse CSV/TSV
    const parseResult = Papa.parse<OccurrenceRecord>(content, {
      header: true,
      delimiter: '', // Auto-detect
      skipEmptyLines: true,
      dynamicTyping: false, // Keep everything as strings
    });
    
    if (parseResult.errors.length > 0) {
      console.warn('CSV parsing warnings:', parseResult.errors);
    }
    
    onProgress?.('Processing records', 80);
    
    const records = parseResult.data;
    const columns = parseResult.meta.fields || [];
    
    // Validate required columns
    const requiredColumns = ['decimalLatitude', 'decimalLongitude', 'taxonKey'];
    const missingColumns = requiredColumns.filter(col => !columns.includes(col));
    
    if (missingColumns.length > 0) {
      throw new Error(
        `Missing required columns: ${missingColumns.join(', ')}. ` +
        `Available columns: ${columns.join(', ')}`
      );
    }
    
    // Extract unique taxon keys from all taxonomic ranks
    const taxonKeySet = new Set<number>();
    const taxonomicFields = ['taxonKey', 'speciesKey', 'genusKey', 'familyKey', 'orderKey', 'classKey', 'phylumKey', 'kingdomKey'];
    
    records.forEach(record => {
      taxonomicFields.forEach(field => {
        const value = record[field];
        if (value && !isNaN(Number(value))) {
          taxonKeySet.add(Number(value));
        }
      });
    });
    
    const uniqueTaxonKeys = Array.from(taxonKeySet).sort((a, b) => a - b);
    
    onProgress?.('Complete', 100);
    
    return {
      records,
      columns,
      filename: baseName,
      recordCount: records.length,
      uniqueTaxonKeys: uniqueTaxonKeys,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to process download: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate download file before processing
 */
export function validateDownloadFile(file: File): { valid: boolean; error?: string } {
  // Check file extension
  if (!file.name.toLowerCase().endsWith('.zip')) {
    return { valid: false, error: 'File must be a .zip file' };
  }
  
  // Check file size (limit to ~500MB uncompressed, ~100MB compressed)
  const maxSizeMB = 100;
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > maxSizeMB) {
    return {
      valid: false,
      error: `File too large (${fileSizeMB.toFixed(1)}MB). Maximum size is ${maxSizeMB}MB`,
    };
  }
  
  return { valid: true };
}

/**
 * Generate CSV/TSV file content from records
 */
export function generateCSV(
  records: OccurrenceRecord[],
  columns: string[],
  delimiter: '\t' | ',' = '\t'
): string {
  return Papa.unparse(records, {
    columns: columns,
    delimiter: delimiter,
    header: true,
  });
}

/**
 * Download a file to the user's computer
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Estimate record count from file size (rough estimate)
 */
export function estimateRecordCount(fileSizeBytes: number): number {
  // Rough estimate: ~500 bytes per record compressed
  return Math.floor(fileSizeBytes / 500);
}
