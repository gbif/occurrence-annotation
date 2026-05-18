// Simple in-memory cache for GBIF dataset information
const datasetCache = new Map<string, any>();

export const getDatasetInfo = async (datasetKey: string) => {
  // Check cache first
  if (datasetCache.has(datasetKey)) {
    return datasetCache.get(datasetKey);
  }

  try {
    const response = await fetch(`https://api.gbif.org/v1/dataset/${datasetKey}`);
    
    if (response.ok) {
      const data = await response.json();
      const datasetInfo = {
        key: data.key,
        title: data.title,
        publishingOrganizationTitle: data.publishingOrganizationTitle,
        publisher: data.publisher,
        type: data.type,
      };
      
      // Cache the result
      datasetCache.set(datasetKey, datasetInfo);
      return datasetInfo;
    }
  } catch (error) {
    console.error(`Error fetching dataset info for ${datasetKey}:`, error);
  }
  
  return null;
};

export const clearDatasetCache = () => {
  datasetCache.clear();
};
