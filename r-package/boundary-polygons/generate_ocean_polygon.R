# Generate Ocean Boundary Polygon for Occurrence Annotation UI
# 
# This script generates the ocean boundary polygon used by the "Subtract Ocean" feature.
# It uses Natural Earth 1:110m ocean data to create a simplified global ocean polygon.
#
# **Current Usage**: Ocean polygon generation (--mode=ocean, default)
# **Legacy Capability**: Also supports continent polygon generation via ISEA3H grid + GBIF geocoding
#
# Primary output: Ocean boundary as MULTIPOLYGON WKT in country_polygons.json
# File size: ~50-180 KB depending on mode
#
# Runtime: 
# - Ocean only: <1 minute (recommended)
# - Full generation: 30-120 minutes (includes GBIF API geocoding for continents)
#
# Usage:
#   Rscript generate_ocean_polygon.R                      # Generate ocean only (fast, recommended)
#   Rscript generate_ocean_polygon.R --mode=ocean         # Same as above (explicit)
#   Rscript generate_ocean_polygon.R --mode=both          # Generate both continents and ocean
#   Rscript generate_ocean_polygon.R --mode=continents    # Only regenerate continents (keeps existing ocean)
#
# Output JSON format:
# [{"identifier": "OCEAN", "type": "IHO", "name": "Ocean", 
#   "wkt": "MULTIPOLYGON(...)", "vertexCount": 1234}, ...]

# Required packages
required_packages <- c("sf", "dplyr", "httr", "jsonlite", "stringr")
missing_packages <- required_packages[!required_packages %in% installed.packages()[,"Package"]]

if(length(missing_packages) > 0) {
  message("Installing missing packages: ", paste(missing_packages, collapse = ", "))
  install.packages(missing_packages)
}

library(sf)
library(dplyr)
library(httr)
library(jsonlite)
library(stringr)

# Disable S2 for better global polygon handling (as used in gbifrules)
sf::sf_use_s2(FALSE)

# Parse command-line arguments
args <- commandArgs(trailingOnly = TRUE)
RUN_MODE <- "ocean"  # Default: ocean only (fast, recommended for Subtract Ocean feature)

if (length(args) > 0) {
  for (arg in args) {
    if (grepl("^--mode=", arg)) {
      RUN_MODE <- sub("^--mode=", "", arg)
    }
  }
}

# Validate RUN_MODE
if (!RUN_MODE %in% c("both", "continents", "ocean")) {
  stop("Invalid --mode argument. Use: both, continents, or ocean")
}

# Configuration
TEST_MODE <- FALSE             # Set to TRUE to process only first 100 hexagons for testing
TEST_HEXAGON_COUNT <- 100     # Number of hexagons to process in test mode
SAMPLE_GRID_SIZE <- 5         # Sample grid size (5x5 = 25 points per hexagon for better accuracy)

CACHE_DIR <- "cache"
OUTPUT_DIR <- "output"
ISEA3H_DIR <- "isea3h-data"
NATURAL_EARTH_DIR <- "natural-earth-data"
GEOCODE_CACHE_FILE <- file.path(CACHE_DIR, "geocode_results.rds")
COUNTRY_POLYGONS_FILE <- file.path(OUTPUT_DIR, "country_polygons.json")
FRONTEND_OUTPUT <- "../../ui/public/country_polygons.json"

# GBIF API configuration
GBIF_GEOCODE_API <- "https://api.gbif.org/v1/geocode/reverse"
GBIF_COUNTRY_API <- "https://api.gbif.org/v1/enumeration/country"
RATE_LIMIT_DELAY <- 0.05  # 50ms delay = ~20 req/sec (conservative)

# Polygon simplification tolerance (degrees)
SIMPLIFY_TOLERANCE <- 0.01  # ~1.1 km at equator

# Create directories
dir.create(CACHE_DIR, showWarnings = FALSE, recursive = TRUE)
dir.create(OUTPUT_DIR, showWarnings = FALSE, recursive = TRUE)
dir.create(ISEA3H_DIR, showWarnings = FALSE, recursive = TRUE)
dir.create(NATURAL_EARTH_DIR, showWarnings = FALSE, recursive = TRUE)

message("========================================")
message("Geographic Boundary Polygon Generator")
message("(Continent, Ocean)")
message("========================================\n")

# ============================================================================
# Step 1a: Download Natural Earth Ocean Data
# ============================================================================
download_natural_earth_ocean <- function() {
  message("[Step 1a] Downloading Natural Earth 1:110m land shapefile...")
  
  shapefile_path <- file.path(NATURAL_EARTH_DIR, "ne_110m_land.shp")
  
  if (file.exists(shapefile_path)) {
    message("  ✓ Shapefile already exists, skipping download")
    return(shapefile_path)
  }
  
  # Natural Earth ocean download URL (1:110m - lowest resolution, CDN)
  # NOTE: Using land polygons to create ocean by inversion for complete coverage
  ocean_url <- "https://naciscdn.org/naturalearth/110m/physical/ne_110m_land.zip"
  zip_path <- file.path(NATURAL_EARTH_DIR, "ne_110m_land.zip")
  
  message("  Downloading Natural Earth ocean zip...")
  tryCatch({
    download.file(ocean_url, zip_path, mode = "wb", quiet = TRUE)
    message("    ✓ Downloaded ocean zip")
  }, error = function(e) {
    stop(sprintf("Failed to download Natural Earth ocean: %s", e$message))
  })
  
  # Extract zip file
  message("  Extracting shapefile...")
  tryCatch({
    unzip(zip_path, exdir = NATURAL_EARTH_DIR)
    message("    ✓ Extracted shapefile components")
  }, error = function(e) {
    stop(sprintf("Failed to extract ocean zip: %s", e$message))
  })
  
  # Clean up zip file
  if (file.exists(zip_path)) {
    file.remove(zip_path)
  }
  
  message("  ✓ Natural Earth land shapefile downloaded successfully\n")
  return(shapefile_path)
}

# ============================================================================
# Step 1b: Download ISEA3H Shapefiles
# ============================================================================
download_isea3h_data <- function() {
  message("[Step 1b] Downloading ISEA3H resolution-6 shapefiles...")
  
  shapefile_path <- file.path(ISEA3H_DIR, "ISEA3H-6.shp")
  
  if (file.exists(shapefile_path)) {
    message("  ✓ Shapefile already exists, skipping download")
    return(shapefile_path)
  }
  
  # GitHub raw URL for the shapefile components
  base_url <- "https://github.com/jhnwllr/ISEA3H-shapefiles/raw/main/resolution-6/"
  extensions <- c("shp", "shx", "dbf", "prj")
  
  message("  Downloading shapefile components...")
  for (ext in extensions) {
    url <- paste0(base_url, "ISEA3H-6.", ext)
    dest <- file.path(ISEA3H_DIR, paste0("ISEA3H-6.", ext))
    
    tryCatch({
      download.file(url, dest, mode = "wb", quiet = TRUE)
      message(sprintf("    ✓ Downloaded .%s", ext))
    }, error = function(e) {
      stop(sprintf("Failed to download .%s: %s", ext, e$message))
    })
  }
  
  message("  ✓ ISEA3H shapefile downloaded successfully\n")
  return(shapefile_path)
}

# ============================================================================
# Step 2: Load and Transform ISEA3H Grid
# ============================================================================
load_isea3h_grid <- function(shapefile_path) {
  message("[Step 2] Loading ISEA3H grid...")
  
  hexagons <- st_read(shapefile_path, quiet = TRUE)
  message(sprintf("  Loaded %d hexagons", nrow(hexagons)))
  
  # Check and transform to WGS84 if needed
  current_crs <- st_crs(hexagons)
  message(sprintf("  Current CRS: %s", current_crs$input))
  
  if (st_crs(hexagons) != st_crs(4326)) {
    message("  Transforming to WGS84 (EPSG:4326)...")
    hexagons <- st_transform(hexagons, 4326)
  }
  
  # Add hexagon ID if not present
  if (!"hex_id" %in% names(hexagons)) {
    hexagons$hex_id <- seq_len(nrow(hexagons))
  }
  
  # Apply test mode limit if enabled
  if (TEST_MODE) {
    message(sprintf("  [TEST MODE] Limiting to first %d hexagons", TEST_HEXAGON_COUNT))
    hexagons <- hexagons[1:min(TEST_HEXAGON_COUNT, nrow(hexagons)), ]
  }
  
  message("  ✓ Grid loaded and transformed\n")
  return(hexagons)
}

# ============================================================================
# Step 3: Generate Sample Points Grid (3x3 per hexagon)
# ============================================================================
generate_sample_points <- function(hexagons) {
  message(sprintf("[Step 3] Generating sample points (%dx%d grid per hexagon)...", SAMPLE_GRID_SIZE, SAMPLE_GRID_SIZE))
  
  all_points <- list()
  
  for (i in seq_len(nrow(hexagons))) {
    hex <- hexagons[i, ]
    bbox <- st_bbox(hex)
    
    # Create grid within bounding box (size configurable via SAMPLE_GRID_SIZE)
    lon_seq <- seq(bbox["xmin"], bbox["xmax"], length.out = SAMPLE_GRID_SIZE)
    lat_seq <- seq(bbox["ymin"], bbox["ymax"], length.out = SAMPLE_GRID_SIZE)
    
    grid_points <- expand.grid(lon = lon_seq, lat = lat_seq)
    
    # Convert to sf points and filter to only those within hexagon
    points_sf <- st_as_sf(grid_points, coords = c("lon", "lat"), crs = 4326)
    points_within <- points_sf[st_within(points_sf, hex, sparse = FALSE)[,1], ]
    
    if (nrow(points_within) > 0) {
      coords <- st_coordinates(points_within)
      all_points[[i]] <- data.frame(
        hex_id = hexagons$hex_id[i],
        lon = coords[, "X"],
        lat = coords[, "Y"]
      )
    }
    
    if (i %% 1000 == 0) {
      message(sprintf("  Processed %d / %d hexagons", i, nrow(hexagons)))
    }
  }
  
  points_df <- bind_rows(all_points)
  message(sprintf("  ✓ Generated %d sample points\n", nrow(points_df)))
  
  return(points_df)
}

# ============================================================================
# Step 4: Geocode Points with GBIF API (with caching and resume)
# ============================================================================
geocode_points <- function(points_df) {
  message("[Step 4] Geocoding points with GBIF API...")
  
  # Test API access with a known location first
  message("  Testing GBIF geocode API access...")
  test_url <- sprintf("%s?lat=40.7128&lng=-74.0060", GBIF_GEOCODE_API)  # New York City
  test_response <- tryCatch({
    GET(test_url)
  }, error = function(e) {
    stop("Failed to connect to GBIF API: ", e$message)
  })
  
  if (status_code(test_response) != 200) {
    stop(sprintf("GBIF API returned status %d. API may be down or access restricted.", 
                 status_code(test_response)))
  }
  
  test_content <- content(test_response, as = "parsed")
  message(sprintf("  ✓ API test successful. Response: %d locations returned", length(test_content)))
  
  # API returns array of locations - find first Continent result
  test_result <- NULL
  for (location in test_content) {
    if (!is.null(location$type) && location$type == "Continent") {
      test_result <- location
      break
    }
  }
  
  if (is.null(test_result)) {
    stop("GBIF API test failed: No Continent result found")
  }
  
  # Use title as identifier for Continent
  test_identifier <- test_result$title
  
  message(sprintf("  ✓ Test location returned %s: %s (%s)", 
                 test_result$type, test_identifier, test_result$title))
  
  # Initialize empty results dataframe with correct structure
  geocode_results <- data.frame(
    lon = numeric(),
    lat = numeric(),
    hex_id = integer(),
    type = character(),          # "Continent" only
    identifier = character(),    # title for Continent
    name = character(),          # Display name from API title field
    iso2_code = character(),     # Not used (kept for compatibility)
    timestamp = as.POSIXct(character()),
    stringsAsFactors = FALSE
  )
  
  # Load cache if exists
  if (file.exists(GEOCODE_CACHE_FILE)) {
    message("  Loading cached geocode results...")
    cached_results <- readRDS(GEOCODE_CACHE_FILE)
    message(sprintf("  ✓ Loaded %d cached results", nrow(cached_results)))
    
    if (nrow(cached_results) > 0) {
      geocode_results <- cached_results
      
      # Identify points that still need geocoding
      points_to_geocode <- points_df %>%
        anti_join(cached_results, by = c("lon", "lat"))
      
      if (nrow(points_to_geocode) == 0) {
        message("  ✓ All points already geocoded!\n")
        return(cached_results)
      }
      
      message(sprintf("  %d points remaining to geocode", nrow(points_to_geocode)))
    } else {
      message("  Cache file exists but is empty, starting fresh")
      points_to_geocode <- points_df
    }
  } else {
    message("  No cache found, starting fresh")
    points_to_geocode <- points_df
  }
  
  # Geocode remaining points
  message(sprintf("  Geocoding %d points (this may take a while)...", nrow(points_to_geocode)))
  
  start_time <- Sys.time()
  checkpoint_interval <- 10000
  success_count <- 0
  no_country_count <- 0
  error_count <- 0
  
  for (i in seq_len(nrow(points_to_geocode))) {
    lat <- points_to_geocode$lat[i]
    lon <- points_to_geocode$lon[i]
    
    # Call GBIF geocode API
    url <- sprintf("%s?lat=%f&lng=%f", GBIF_GEOCODE_API, lat, lon)
    
    tryCatch({
      response <- GET(url)
      
      if (status_code(response) == 200) {
        content_list <- content(response, as = "parsed")
        
        # Only capture Continent results (ocean points will be ignored)
        continent_result <- NULL
        
        for (location in content_list) {
          if (!is.null(location$type)) {
            if (location$type == "Continent" && !is.null(location$title)) {
              continent_result <- location
              break  # Take first Continent result
            }
          }
        }
        
        # Use continent result if found (ocean points will have NULL)
        selected_result <- continent_result
        
        if (!is.null(selected_result)) {
          # Extract fields for Continent type
          boundary_type <- selected_result$type  # Will be "Continent"
          boundary_name <- if (!is.null(selected_result$title)) as.character(selected_result$title) else ""
          
          # Identifier: use title for Continent
          boundary_identifier <- boundary_name
          
          # iso2_code: not used for Continent (kept for compatibility)
          iso2_code <- ""
          
          new_row <- data.frame(
            lon = lon,
            lat = lat,
            hex_id = points_to_geocode$hex_id[i],
            type = boundary_type,
            identifier = boundary_identifier,
            name = boundary_name,
            iso2_code = iso2_code,
            timestamp = Sys.time()
          )
          geocode_results <- bind_rows(geocode_results, new_row)
          success_count <- success_count + 1
        } else {
          no_country_count <- no_country_count + 1
          # Log first few failures for diagnostics
          if (no_country_count <= 3) {
            message(sprintf("\n  Point %d (%f, %f) returned no Continent result (likely ocean)", i, lat, lon))
          }
        }
      } else if (status_code(response) == 429) {
        # Rate limited - wait and retry
        message("\n  Rate limited, waiting 5 seconds...")
        Sys.sleep(5)
        i <- i - 1  # Retry this point
        next
      } else {
        error_count <- error_count + 1
        if (error_count <= 5) {
          message(sprintf("\n  Point %d returned status %d", i, status_code(response)))
        }
      }
    }, error = function(e) {
      error_count <- error_count + 1
      if (error_count <= 5) {
        message(sprintf("\n  Error geocoding point %d (%f, %f): %s", i, lat, lon, e$message))
      }
    })
    
    # Rate limiting
    Sys.sleep(RATE_LIMIT_DELAY)
    
    # Progress and checkpointing
    if (i %% 100 == 0) {
      elapsed <- as.numeric(difftime(Sys.time(), start_time, units = "secs"))
      rate <- i / elapsed
      remaining <- (nrow(points_to_geocode) - i) / rate
      message(sprintf("  Progress: %d / %d (%.1f%%, ETA: %.1f min, Success: %d, No country: %d, Errors: %d)", 
                     i, nrow(points_to_geocode), 
                     100 * i / nrow(points_to_geocode),
                     remaining / 60,
                     success_count, no_country_count, error_count))
    }
    
    if (i %% checkpoint_interval == 0) {
      message("  Saving checkpoint...")
      saveRDS(geocode_results, GEOCODE_CACHE_FILE)
    }
  }
  
  # Final save and summary
  message("  Saving final geocode results...")
  saveRDS(geocode_results, GEOCODE_CACHE_FILE)
  
  message(sprintf("  ✓ Geocoded %d points with valid boundary results", nrow(geocode_results)))
  message(sprintf("  Summary: %d success, %d no boundary, %d errors\n", 
                 success_count, no_country_count, error_count))
  
  if (nrow(geocode_results) == 0) {
    stop("ERROR: No valid geocoding results found! All points returned no boundary results.\n",
         "This could indicate:\n",
         "  - API access issues\n",
         "  - Changed API response format\n",
         "  - All sample points fall outside recognized boundaries\n",
         "Check the diagnostic messages above for details.")
  }
  
  return(geocode_results)
}

# ============================================================================
# Step 5: Assign Boundaries to Hexagons (majority vote for multi-boundary hexes)
# ============================================================================
assign_countries_to_hexagons <- function(hexagons, geocode_results) {
  message("[Step 5] Assigning boundaries to hexagons...")
  
  # Count boundary occurrences per hexagon
  hex_boundaries <- geocode_results %>%
    group_by(hex_id, type, identifier) %>%
    summarise(
      point_count = n(),
      # Take the first name (they should all be the same for a given identifier)
      name = first(name),
      iso2_code = first(iso2_code),
      .groups = "drop"
    ) %>%
    arrange(hex_id, desc(point_count))
  
  # For each hexagon, take the boundary with most sample points (majority vote)
  hex_assignments <- hex_boundaries %>%
    group_by(hex_id) %>%
    slice_max(point_count, n = 1, with_ties = FALSE) %>%
    select(hex_id, type, identifier, name, iso2_code)
  
  # Join with hexagon geometries
  hexagons_with_countries <- hexagons %>%
    inner_join(hex_assignments, by = "hex_id")
  
  # Count boundaries by type for summary message
  type_counts <- hexagons_with_countries %>%
    st_drop_geometry() %>%
    group_by(type) %>%
    summarise(n_boundaries = n_distinct(identifier), .groups = "drop")
  
  message(sprintf("  ✓ Assigned %d hexagons to boundaries:", nrow(hexagons_with_countries)))
  for (i in seq_len(nrow(type_counts))) {
    message(sprintf("    - %s: %d", type_counts$type[i], type_counts$n_boundaries[i]))
  }
  message("")
  
  return(hexagons_with_countries)
}

# ============================================================================
# Step 6: Dissolve Hexagons by Boundary
# ============================================================================
dissolve_by_country <- function(hexagons_with_countries) {
  message("[Step 6] Dissolving hexagons by boundary...")
  
  country_polygons <- hexagons_with_countries %>%
    group_by(type, identifier) %>%
    summarise(
      geometry = st_union(geometry),
      # Preserve name and iso2_code (take first, they should all be the same for a given identifier)
      name = first(name),
      iso2_code = first(iso2_code),
      .groups = "drop"
    )
  
  # Simplify polygons to reduce vertex count
  message(sprintf("  Simplifying polygons (tolerance: %f degrees)...", SIMPLIFY_TOLERANCE))
  country_polygons <- country_polygons %>%
    mutate(geometry = st_simplify(geometry, dTolerance = SIMPLIFY_TOLERANCE))
  
  message(sprintf("  ✓ Created %d country polygons\n", nrow(country_polygons)))
  return(country_polygons)
}

# ============================================================================
# Step 7: Load Natural Earth Ocean (by inverting land polygons)
# ============================================================================
load_natural_earth_ocean <- function(shapefile_path) {
  message("[Step 7] Creating ocean polygon from Natural Earth land...")
  
  # Load land shapefile
  land_sf <- st_read(shapefile_path, quiet = TRUE)
  message(sprintf("  Loaded %d land feature(s)", nrow(land_sf)))
  
  # Transform to WGS84 if needed
  if (st_crs(land_sf) != st_crs(4326)) {
    message("  Transforming to WGS84 (EPSG:4326)...")
    land_sf <- st_transform(land_sf, 4326)
  }
  
  # Union all land geometries
  message("  Merging all land polygons...")
  land_union <- st_union(land_sf$geometry)
  
  # Create world bounding box (global ocean extent)
  message("  Creating global ocean extent...")
  world_box <- st_as_sfc("POLYGON((-180 -90, 180 -90, 180 90, -180 90, -180 -90))", crs = 4326)
  
  # Subtract land from world box to get ocean
  message("  Subtracting land from world extent to create ocean...")
  ocean_geometry <- st_difference(world_box, land_union)
  
  # Simplify using same tolerance as continents
  message(sprintf("  Simplifying ocean polygon (tolerance: %f degrees)...", SIMPLIFY_TOLERANCE))
  ocean_geometry <- st_simplify(ocean_geometry, dTolerance = SIMPLIFY_TOLERANCE)
  
  # Create ocean boundary in same format as continents
  ocean_boundary <- st_sf(
    type = "IHO",  # Keep IHO type for compatibility with UI
    identifier = "OCEAN",
    name = "Ocean",
    iso2_code = "",
    geometry = ocean_geometry,
    crs = 4326
  )
  
  # Count vertices for reporting
  coords <- st_coordinates(ocean_boundary$geometry)
  vertex_count <- nrow(coords)
  
  message(sprintf("  ✓ Ocean boundary created (%d vertices)\n", vertex_count))
  
  return(ocean_boundary)
}

# ============================================================================
# Utility: Load Existing Boundaries from JSON
# ============================================================================
load_existing_boundaries <- function(json_path, type_filter = NULL) {
  message(sprintf("[Utility] Loading existing boundaries from %s...", json_path))
  
  if (!file.exists(json_path)) {
    stop(sprintf("JSON file not found: %s", json_path))
  }
  
  # Read JSON
  json_data <- fromJSON(json_path, simplifyDataFrame = FALSE)
  
  # Convert to sf data frame
  boundaries <- list()
  for (i in seq_along(json_data)) {
    boundary <- json_data[[i]]
    
    # Skip if type filter specified and doesn't match
    if (!is.null(type_filter) && !boundary$type %in% type_filter) {
      next
    }
    
    # Parse WKT geometry
    geom <- st_as_sfc(boundary$wkt, crs = 4326)
    
    boundaries[[length(boundaries) + 1]] <- st_sf(
      type = boundary$type,
      identifier = boundary$identifier,
      name = boundary$name,
      iso2_code = if (!is.null(boundary$iso2)) boundary$iso2 else "",
      geometry = geom
    )
  }
  
  if (length(boundaries) == 0) {
    stop("No boundaries found matching criteria")
  }
  
  result <- do.call(rbind, boundaries)
  message(sprintf("  ✓ Loaded %d boundaries\n", nrow(result)))
  
  return(result)
}

# ============================================================================
# DEPRECATED: Step 7 Old - Fetch Country Names from GBIF API
# ============================================================================
fetch_country_names <- function(iso2_codes) {
  message("[Step 7] Fetching country names from GBIF API...")
  
  country_names <- list()
  
  for (iso2 in iso2_codes) {
    url <- paste0(GBIF_COUNTRY_API, "/", iso2)
    
    tryCatch({
      response <- GET(url)
      if (status_code(response) == 200) {
        content <- content(response, as = "parsed")
        # Ensure we always have a string, fallback to ISO2 if title is NULL/empty
        name <- if (!is.null(content$title) && nchar(as.character(content$title)) > 0) {
          as.character(content$title)
        } else {
          iso2
        }
        country_names[[iso2]] <- name
      } else {
        country_names[[iso2]] <- iso2  # Fallback to code
      }
    }, error = function(e) {
      country_names[[iso2]] <- iso2
    })
    
    Sys.sleep(RATE_LIMIT_DELAY)
  }
  
  message("  ✓ Fetched country names\n")
  return(country_names)
}

# ============================================================================
# DEPRECATED: Merge Ocean Polygons (no longer needed with Natural Earth)
# ============================================================================
# Function removed - Natural Earth provides single clean ocean polygon

# ============================================================================
# Step 9: Export as JSON
# ============================================================================
export_country_polygons <- function(country_polygons) {
  message("[Step 9] Exporting boundary polygons as JSON...")
  
  # Note: Boundary names are already in country_polygons from geocoding
  # No need to fetch separately from GBIF enumeration API
  
  # Convert to WKT and count vertices
  country_data <- list()
  
  for (i in seq_len(nrow(country_polygons))) {
    boundary_type <- country_polygons$type[i]
    identifier <- country_polygons$identifier[i]
    geom <- country_polygons$geometry[i]
    wkt <- st_as_text(geom)
    
    # Count vertices
    coords <- st_coordinates(geom)
    vertex_count <- nrow(coords)
    
    # Handle NA values - convert to character safely
    boundary_type <- if (is.na(boundary_type)) "Unknown" else as.character(boundary_type)
    identifier <- if (is.na(identifier)) "UNKNOWN" else as.character(identifier)
    
    # Get name from cached data (from geocode response)
    name <- country_polygons$name[i]
    if (is.na(name) || is.null(name) || !is.character(name) || nchar(as.character(name)) == 0) {
      name <- identifier  # Fallback to identifier
    }
    name <- as.character(name)
    
    # Get iso2_code (only populated for Political type, empty string for others)
    iso2 <- country_polygons$iso2_code[i]
    if (is.na(iso2) || is.null(iso2) || !is.character(iso2)) {
      iso2 <- ""
    }
    iso2 <- as.character(iso2)
    
    country_data[[i]] <- list(
      identifier = identifier,
      type = boundary_type,
      name = name,
      wkt = wkt,
      vertexCount = vertex_count,
      iso2 = iso2  # Backward compatibility, empty for non-Political
    )
  }
  
  # Write to output directory
  json_str <- toJSON(country_data, pretty = TRUE, auto_unbox = TRUE)
  writeLines(json_str, COUNTRY_POLYGONS_FILE)
  message(sprintf("  ✓ Saved to: %s", COUNTRY_POLYGONS_FILE))
  
  # Copy to frontend public directory (served as static asset)
  frontend_dir <- dirname(FRONTEND_OUTPUT)
  dir.create(frontend_dir, showWarnings = FALSE, recursive = TRUE)
  file.copy(COUNTRY_POLYGONS_FILE, FRONTEND_OUTPUT, overwrite = TRUE)
  message(sprintf("  ✓ Copied to frontend: %s", FRONTEND_OUTPUT))
  
  # Summary statistics
  file_size_mb <- file.size(COUNTRY_POLYGONS_FILE) / 1024 / 1024
  total_vertices <- sum(sapply(country_data, function(x) x$vertexCount))
  avg_vertices <- mean(sapply(country_data, function(x) x$vertexCount))
  max_vertices <- max(sapply(country_data, function(x) x$vertexCount))
  
  # Count by type
  type_counts <- table(sapply(country_data, function(x) x$type))
  
  message("\n========================================")
  message("Summary")
  message("========================================")
  message(sprintf("Total boundaries: %d", length(country_data)))
  for (type_name in names(type_counts)) {
    message(sprintf("  - %s: %d", type_name, type_counts[type_name]))
  }
  message(sprintf("Total vertices: %d", total_vertices))
  message(sprintf("Avg vertices per boundary: %.0f", avg_vertices))
  message(sprintf("Max vertices: %d", max_vertices))
  message(sprintf("File size: %.2f MB", file_size_mb))
  message("========================================\n")
  
  return(country_data)
}

# ============================================================================
# Main Execution
# ============================================================================
main <- function() {
  if (TEST_MODE) {
    message("========================================")
    message("  TEST MODE ENABLED")
    message(sprintf("  Processing only first %d hexagons", TEST_HEXAGON_COUNT))
    message("========================================\n")
  }
  
  message("========================================")
  message(sprintf("  RUN MODE: %s", toupper(RUN_MODE)))
  message("========================================\n")
  
  message("Starting geographic boundary polygon generation pipeline...\n")
  overall_start <- Sys.time()
  
  continent_polygons <- NULL
  ocean_polygon <- NULL
  
  # Mode: Continents only or Both
  if (RUN_MODE %in% c("both", "continents")) {
    # Step 1: Download ISEA3H data
    shapefile_path <- download_isea3h_data()
    
    # Step 2: Load grid
    hexagons <- load_isea3h_grid(shapefile_path)
    
    # Step 3: Generate sample points
    sample_points <- generate_sample_points(hexagons)
    
    # Step 4: Geocode points (Continent only)
    geocode_results <- geocode_points(sample_points)
    
    # Step 5: Assign boundaries to hexagons
    hexagons_with_countries <- assign_countries_to_hexagons(hexagons, geocode_results)
    
    # Step 6: Dissolve by boundary (creates continent polygons)
    continent_polygons <- dissolve_by_country(hexagons_with_countries)
  } else {
    # Mode: Ocean only - load existing continents from JSON
    message("[Mode: Ocean Only] Loading existing continent boundaries...\n")
    continent_polygons <- load_existing_boundaries(COUNTRY_POLYGONS_FILE, type_filter = c("Continent"))
  }
  
  # Mode: Ocean only or Both
  if (RUN_MODE %in% c("both", "ocean")) {
    # Step 7a: Download Natural Earth ocean
    ocean_shapefile <- download_natural_earth_ocean()
    
    # Step 7b: Load Natural Earth ocean
    ocean_polygon <- load_natural_earth_ocean(ocean_shapefile)
  } else {
    # Mode: Continents only - load existing ocean from JSON
    message("[Mode: Continents Only] Loading existing ocean boundary...\n")
    ocean_polygon <- load_existing_boundaries(COUNTRY_POLYGONS_FILE, type_filter = c("IHO"))
  }
  
  # Step 8: Combine continents and ocean
  message("[Step 8] Combining continent and ocean boundaries...")
  all_boundaries <- bind_rows(continent_polygons, ocean_polygon)
  message(sprintf("  ✓ Total boundaries: %d (Continent: %d, Ocean: %d)\n", 
                  nrow(all_boundaries),
                  nrow(continent_polygons),
                  nrow(ocean_polygon)))
  
  # Step 9: Export
  country_data <- export_country_polygons(all_boundaries)
  
  overall_time <- difftime(Sys.time(), overall_start, units = "mins")
  message(sprintf("✓ Pipeline completed in %.1f minutes", overall_time))
  
  return(invisible(country_data))
}

# Run the pipeline
if (!interactive()) {
  main()
}

