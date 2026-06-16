// GBIF Backbone Checklist UUID for v2 API
const GBIF_BACKBONE_UUID = '7ddf754f-d193-4cc9-b351-99906754a03b';

// Simple in-memory cache for species information
const speciesCache = new Map<string, any>();

export const getSpeciesInfo = async (taxonKey: string) => {
  // Check cache first
  if (speciesCache.has(taxonKey)) {
    return speciesCache.get(taxonKey);
  }

  try {
    const response = await fetch(`https://api.gbif.org/v2/experimental/taxon/${GBIF_BACKBONE_UUID}/${taxonKey}`);
    
    if (response.ok) {
      const data = await response.json();
      const speciesInfo = {
        key: data.taxonID,
        scientificName: data.scientificName,
        canonicalName: data.canonicalName,
        vernacularName: data.vernacularNames?.[0]?.vernacularName,
        rank: data.taxonRank,
      };
      
      // Cache the result
      speciesCache.set(taxonKey, speciesInfo);
      return speciesInfo;
    }
  } catch (error) {
    console.error('Error fetching species info:', error);
  }
  
  return null;
};

export const clearSpeciesCache = () => {
  speciesCache.clear();
};