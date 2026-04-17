// OpenAI Service for Location Quality Evaluation
import { getOpenAIApiKey } from './apiConfig';

export interface LocationQualityReport {
  suspicious: boolean;
  severity: 'high' | 'medium' | 'low' | 'none';
  summary: string;
  issues: string[];
}

export interface GBIFOccurrenceData {
  key: number;
  scientificName?: string;
  decimalLatitude?: number;
  decimalLongitude?: number;
  coordinateUncertaintyInMeters?: number;
  locality?: string;
  country?: string;
  countryCode?: string;
  stateProvince?: string;
  continent?: string;
  basisOfRecord?: string;
  eventDate?: string;
  recordedBy?: string;
  institutionCode?: string;
  collectionCode?: string;
  catalogNumber?: string;
  datasetKey?: string;
  publishingOrgKey?: string;
  issues?: string[];
  gbifID?: string;
}

/**
 * Fetch GBIF occurrence data by ID
 */
async function fetchOccurrenceData(gbifid: number): Promise<GBIFOccurrenceData> {
  const response = await fetch(`https://api.gbif.org/v1/occurrence/${gbifid}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch occurrence data: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Call OpenAI to evaluate location quality
 */
async function callOpenAI(occurrence: GBIFOccurrenceData): Promise<string> {
  const apiKey = getOpenAIApiKey();
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please set VITE_OPENAI_API_KEY in your .env file.');
  }

  const systemPrompt = `You are a GBIF data quality expert specializing in identifying location-related issues in biodiversity occurrence records. Your task is to analyze occurrence data and identify potential location quality problems.

**Primary Focus Areas:**
1. **Species-locality fit**: Does the location make sense for this species or taxonomic group? Consider known ranges, habitat requirements, and biogeographic patterns.
2. **Coordinate-locality consistency**: Do the lat/lon coordinates match the stated locality, state/province, and country? Look for mismatches between text descriptions and numeric coordinates.

**Secondary Issues to Check:**
3. **Coordinate swapping**: Latitude and longitude may be reversed
4. **Invalid coordinates**: Values outside valid ranges (lat: -90 to 90, lng: -180 to 180)
5. **Zero coordinates**: Records at 0,0 (often data entry errors)
6. **Institutional coordinates**: Location matches museum/herbarium address rather than collection site
7. **Impossible locations**: Terrestrial species in ocean, marine species on land
8. **Centroid bias**: Coordinates appear to be country/province centroids rather than actual locations
9. **Precision issues**: Coordinates with suspicious precision patterns (e.g., exactly 0.0000)
10. **Geographic outliers**: Location far outside known species range

**De-emphasize:** Existing GBIF quality flags are often not very informative. Focus on biological and geographic plausibility instead.

Respond in JSON format with this structure:
{
  "suspicious": boolean,
  "severity": "high" | "medium" | "low" | "none",
  "summary": "Brief one-sentence assessment",
  "issues": ["issue 1", "issue 2", ...]
}`;

  const userPrompt = `Analyze this GBIF occurrence record for location quality issues:

${JSON.stringify(occurrence, null, 2)}

Key fields to examine:
- scientificName: ${occurrence.scientificName ?? 'not specified'}
- decimalLatitude: ${occurrence.decimalLatitude ?? 'missing'}
- decimalLongitude: ${occurrence.decimalLongitude ?? 'missing'}
- locality: ${occurrence.locality ?? 'not specified'}
- stateProvince: ${occurrence.stateProvince ?? 'not specified'}
- country: ${occurrence.country ?? 'not specified'} (${occurrence.countryCode ?? 'no code'})
- continent: ${occurrence.continent ?? 'not specified'}
- coordinateUncertaintyInMeters: ${occurrence.coordinateUncertaintyInMeters ?? 'not specified'}
- basisOfRecord: ${occurrence.basisOfRecord ?? 'not specified'}

Focus primarily on:
1. Is this location plausible for this species/taxon?
2. Do the coordinates match the locality description?

GBIF quality flags (for reference only, don't over-emphasize): ${occurrence.issues?.join(', ') ?? 'none'}

Provide your assessment in JSON format.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent, focused analysis
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Parse OpenAI response into structured report
 */
function parseOpenAIResponse(responseText: string): LocationQualityReport {
  try {
    const parsed = JSON.parse(responseText);
    
    // Validate required fields
    if (typeof parsed.suspicious !== 'boolean') {
      throw new Error('Invalid response: missing or invalid "suspicious" field');
    }
    
    return {
      suspicious: parsed.suspicious,
      severity: parsed.severity || 'none',
      summary: parsed.summary || 'No assessment provided',
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    };
  } catch (error) {
    console.error('Failed to parse OpenAI response:', error);
    throw new Error('Failed to parse AI response. The response may be malformed.');
  }
}

/**
 * Evaluate location quality for a GBIF occurrence record
 * @param gbifid - The GBIF occurrence ID
 * @returns LocationQualityReport with assessment details
 */
export async function evaluateLocationQuality(gbifid: number): Promise<LocationQualityReport> {
  try {
    // Step 1: Fetch occurrence data from GBIF
    console.log(`Fetching occurrence data for GBIF ID: ${gbifid}`);
    const occurrence = await fetchOccurrenceData(gbifid);
    
    // Step 2: Quick validation - check if coordinates exist
    if (occurrence.decimalLatitude === undefined || occurrence.decimalLongitude === undefined) {
      return {
        suspicious: true,
        severity: 'high',
        summary: 'This record has no coordinates and cannot be evaluated for location quality.',
        issues: ['Missing coordinates (decimalLatitude and/or decimalLongitude)'],
        recommendations: ['Add coordinate data to enable location quality assessment'],
      };
    }
    
    // Step 3: Call OpenAI for analysis
    console.log('Calling OpenAI for location quality analysis...');
    const aiResponse = await callOpenAI(occurrence);
    
    // Step 4: Parse and return structured report
    const report = parseOpenAIResponse(aiResponse);
    console.log('Location quality evaluation completed:', report);
    
    return report;
  } catch (error) {
    console.error('Error evaluating location quality:', error);
    
    // Return error report
    return {
      suspicious: false,
      severity: 'none',
      summary: 'Failed to evaluate location quality',
      issues: [
        'Error occurred during evaluation',
        error instanceof Error ? error.message : 'Unknown error',
      ],
      recommendations: [
        'Check your OpenAI API key configuration',
        'Verify the GBIF occurrence ID is valid',
        'Try again later if this is a temporary issue',
      ],
    };
  }
}

/**
 * Check if OpenAI API is configured
 * @returns true if API key is set, false otherwise
 */
export function isOpenAIConfigured(): boolean {
  return !!getOpenAIApiKey();
}
