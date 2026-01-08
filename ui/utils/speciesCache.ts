// Simple in-memory cache for species information
const speciesCache = new Map<number, any>();

export const getSpeciesInfo = async (taxonKey: number) => {
  // Check cache first
  if (speciesCache.has(taxonKey)) {
    return speciesCache.get(taxonKey);
  }

  try {
    const response = await fetch(`https://api.gbif.org/v1/species/${taxonKey}`);
    
    if (response.ok) {
      const data = await response.json();
      const speciesInfo = {
        key: data.key,
        scientificName: data.scientificName,
        canonicalName: data.canonicalName,
        vernacularName: data.vernacularNames?.[0]?.vernacularName,
        rank: data.rank,
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