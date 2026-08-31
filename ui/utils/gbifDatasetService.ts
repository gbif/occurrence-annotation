/**
 * GBIF Dataset Service
 * 
 * Fetches dataset metadata from GBIF API to retrieve DOI information.
 * Implements session-level caching to minimize API calls.
 */

// Session-level cache for dataset DOIs
const doiCache = new Map<string, string>();

/**
 * Fetch the DOI for a GBIF dataset
 * 
 * @param datasetKey - GBIF dataset UUID
 * @returns Promise resolving to DOI string or null if fetch fails
 */
export async function getChecklistDoi(datasetKey: string): Promise<string | null> {
  // Check cache first
  if (doiCache.has(datasetKey)) {
    return doiCache.get(datasetKey) || null;
  }

  try {
    const response = await fetch(`https://api.gbif.org/v1/dataset/${datasetKey}`);
    
    if (!response.ok) {
      console.error(`Failed to fetch dataset metadata: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const doi = data.doi || null;

    // Cache the result
    if (doi) {
      doiCache.set(datasetKey, doi);
    }

    return doi;
  } catch (error) {
    console.error('Error fetching checklist DOI from GBIF API:', error);
    return null;
  }
}

/**
 * COL Extended Release dataset key constant
 */
export const COL_XR_DATASET_KEY = '7ddf754f-d193-4cc9-b351-99906754a03b';
