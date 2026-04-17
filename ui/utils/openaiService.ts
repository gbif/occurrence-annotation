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

  const systemPrompt = `You are a GBIF data quality expert specializing in identifying location-related issues in biodiversity occurrence records. 

**CRITICAL: Use your extensive knowledge of biogeography, taxonomy, and species distributions to identify impossible or highly unlikely occurrences.**

**Primary Focus Areas (in order of importance):**

1. **Continental-level biogeography**: Apply strict biogeographic knowledge. If a genus or family has NEVER been documented on a continent, flag it as HIGH severity. Examples:
   - Calopteryx (damselfly) does NOT occur in South America (only Europe, Asia, North America)
   - Australian marsupial genera do NOT occur naturally in Africa
   - Many plant families are strictly endemic to specific continents

2. **Species-locality fit**: Does the location make sense for this specific species or group? Consider:
   - Known geographic range (endemic vs. widespread)
   - Habitat requirements (alpine, tropical, marine, etc.)
   - Biogeographic realms and barriers

3. **Coordinate-locality consistency**: Do the lat/lon coordinates match the stated locality, state/province, and country?

**Secondary Issues:**
- Coordinate swapping, invalid values, zero coordinates
- Institutional coordinates (museum addresses)
- Centroid bias, precision issues

**BE STRICT**: If your biogeographic knowledge indicates a taxon does not occur on that continent or in that country, flag it as suspicious with HIGH severity. Don't assume data is correct when it contradicts well-established biogeographic patterns.

**De-emphasize:** Existing GBIF quality flags - these are often not informative.

Respond in JSON format:
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

**Answer these questions in your analysis:**

1. **CRITICAL BIOGEOGRAPHIC CHECK**: Does this genus (or higher taxonomic group) even belong on this continent? 
   - Extract the genus name from scientificName
   - USE YOUR TRAINING DATA: Has this genus EVER been scientifically documented on ${occurrence.continent ?? 'this continent'}?
   - If NO documented occurrences exist for this genus on this continent, flag as HIGH severity suspicious
   - Be STRICT: Don't assume the data is correct when it contradicts established biogeography
   - Example: Calopteryx (damselfly) has ZERO native occurrences in South America - this would be HIGH severity

2. **Species-level range check**: Do we expect this species or group to occur in ${occurrence.country ?? 'this country'}? Consider known geographic range, habitat, and biogeographic patterns.

3. **Coordinate-locality match**: Do the coordinates (${occurrence.decimalLatitude ?? 'N/A'}, ${occurrence.decimalLongitude ?? 'N/A'}) match the locality description "${occurrence.locality ?? 'not provided'}"? Check alignment with ${occurrence.stateProvince ?? 'state/province'} and ${occurrence.country ?? 'country'}.

4. Any other location quality issues (coordinate errors, centroid bias, institutional coordinates, etc.)?

**IMPORTANT**: If you identify a biogeographic impossibility (genus not on continent, marine species on land, etc.), set severity to "high" and suspicious to true.

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
