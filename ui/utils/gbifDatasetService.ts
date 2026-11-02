/**
 * GBIF Dataset Service
 * 
 * Resolves the DOI of the exact ChecklistBank release used by the GBIF
 * species match service for a given checklist key.
 * Implements session-level caching to minimize API calls.
 */

// Session-level cache for checklist DOIs
const doiCache = new Map<string, string>();

/**
 * Resolve the DOI of the ChecklistBank release currently used by the GBIF
 * species match service for the given checklist.
 *
 * Lookup chain (see gbif/occurrence-annotation#129):
 * 1. https://api.gbif.org/v2/species/match/metadata?checklistKey={key}
 *    -> mainIndex.clbDatasetKey (the pinned ChecklistBank release)
 * 2. https://api.checklistbank.org/dataset/simple?id={clbDatasetKey}
 *    -> doi of that release
 *
 * Falls back to the registered GBIF dataset DOI (v1/dataset) if the
 * match-service metadata or ChecklistBank lookup fails.
 *
 * @param checklistKey - GBIF checklist dataset UUID
 * @returns Promise resolving to DOI string or null if all lookups fail
 */
export async function getChecklistDoi(checklistKey: string): Promise<string | null> {
  // Check cache first
  if (doiCache.has(checklistKey)) {
    return doiCache.get(checklistKey) || null;
  }

  const doi =
    (await fetchMatchServiceReleaseDoi(checklistKey)) ||
    (await fetchRegisteredDatasetDoi(checklistKey));

  if (doi) {
    doiCache.set(checklistKey, doi);
  }

  return doi;
}

/**
 * Resolve the DOI of the ChecklistBank release pinned by the species match
 * service for the given checklist key.
 */
async function fetchMatchServiceReleaseDoi(checklistKey: string): Promise<string | null> {
  try {
    const metadataResponse = await fetch(
      `https://api.gbif.org/v2/species/match/metadata?checklistKey=${encodeURIComponent(checklistKey)}`
    );
    if (!metadataResponse.ok) {
      console.error(
        `Failed to fetch species match metadata: ${metadataResponse.status} ${metadataResponse.statusText}`
      );
      return null;
    }

    const metadata = await metadataResponse.json();
    const clbDatasetKey = metadata?.mainIndex?.clbDatasetKey;
    if (!clbDatasetKey) {
      console.error('Species match metadata is missing mainIndex.clbDatasetKey');
      return null;
    }

    const datasetResponse = await fetch(
      `https://api.checklistbank.org/dataset/simple?id=${encodeURIComponent(clbDatasetKey)}`
    );
    if (!datasetResponse.ok) {
      console.error(
        `Failed to fetch ChecklistBank dataset: ${datasetResponse.status} ${datasetResponse.statusText}`
      );
      return null;
    }

    const datasets = await datasetResponse.json();
    const dataset = Array.isArray(datasets) ? datasets[0] : datasets;
    return dataset?.doi || null;
  } catch (error) {
    console.error('Error resolving checklist DOI via species match metadata:', error);
    return null;
  }
}

/**
 * Fallback: fetch the DOI of the registered GBIF dataset.
 */
async function fetchRegisteredDatasetDoi(datasetKey: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.gbif.org/v1/dataset/${datasetKey}`);
    if (!response.ok) {
      console.error(`Failed to fetch dataset metadata: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data.doi || null;
  } catch (error) {
    console.error('Error fetching checklist DOI from GBIF API:', error);
    return null;
  }
}

/**
 * Default checklist key used when saving rules: COL Extended Release (COL XR).
 */
export const DEFAULT_CHECKLIST_KEY = '7ddf754f-d193-4cc9-b351-99906754a03b';
