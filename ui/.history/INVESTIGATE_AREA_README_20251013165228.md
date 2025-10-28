# Investigate Area Feature

## Overview
The Investigate Area tool allows users to search for GBIF occurrence records of a selected species within a small geographic area by simply clicking on the map.

## How to Use

1. **Select a Species**: First, use the species selector to choose the species you want to investigate.

2. **Enable Investigate Mode**: Click the search icon (🔍) button in the header next to the species selector. When active, the button will be highlighted in blue.

3. **Click on Map**: With investigate mode enabled, click anywhere on the map where you want to search for occurrences. The map cursor will change to a crosshair to indicate investigate mode is active.

4. **View Results**: A dialog will open showing:
   - Occurrence records within 2km of the clicked location
   - Species images (if available)
   - Collection/observation details (date, collector, coordinates)
   - Dataset information and publisher
   - Links to view full details on GBIF
   - Distance from clicked point

## Features

### Visual Indicators
- **Blue indicator panel**: Appears in top-right corner when investigate mode is active
- **Crosshair cursor**: Shows when hovering over map in investigate mode
- **Button highlighting**: Search button turns blue when investigate mode is enabled

### Information Displayed
For each occurrence found:
- **Species image**: From GBIF media records
- **Location**: Precise coordinates and distance from search point  
- **Date**: When the specimen was collected/observed
- **Collector**: Person or organization who recorded the occurrence
- **Dataset**: Name and publisher of the source dataset
- **Direct links**: To GBIF occurrence page and dataset page
- **Basis of record**: Whether it's a preserved specimen, observation, etc.
- **Coordinate uncertainty**: Precision of the location data

### Search Parameters
- **Search radius**: 10km from clicked point
- **Limit**: Up to 20 occurrences per search
- **Requires**: Valid coordinates and selected species
- **Preference**: Results with images are prioritized

## Technical Implementation

The feature integrates with:
- **GBIF Occurrence API**: For occurrence data
- **GBIF Dataset API**: For dataset metadata  
- **GBIF Media**: For species images
- **Map click handling**: Coordinates are passed from map to search API
- **Global state management**: Through window object for component communication

## Error Handling

The tool gracefully handles:
- No occurrences found in the area
- Network errors during API calls
- Missing images or metadata
- Invalid species selection
- API rate limiting

## Future Enhancements

Potential improvements could include:
- Adjustable search radius
- Filter by basis of record (specimens vs observations)
- Date range filtering
- Export occurrence data
- Cluster nearby occurrences
- Show uncertainty circles on map