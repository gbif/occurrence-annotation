#!/usr/bin/env Rscript

# ============================================================================
# Generate Country Polygons for GBIF Occurrence Annotation
# ============================================================================
# 
# PURPOSE:
#   Downloads political.gpkg from jhnwllr/gbif-country-polygons,
#   applies buffering and simplification, and exports to JSON format
#   for use as static assets in the frontend UI.
#
# USAGE:
#   Rscript generate_country_polygons.R
#
# OUTPUT:
#   - output/country_polygons.json (working copy)
#   - ../../ui/public/country_polygons.json (frontend static asset)
#
# REQUIREMENTS:
#   - R packages: sf, dplyr, jsonlite, httr
#   - Internet connection (for downloading GPKG)
#
# PROCESSING PARAMETERS:
#   - Buffer: +50 km (expands boundaries to include coastal/border occurrences)
#   - Simplification: 0.05 degrees (~5.5 km at equator, reduces file size)
#
# ============================================================================

# ============================================================================
# Package Dependencies
# ============================================================================
required_packages <- c("sf", "dplyr", "jsonlite", "httr")
missing_packages <- required_packages[!sapply(required_packages, requireNamespace, quietly = TRUE)]

if (length(missing_packages) > 0) {
  stop(sprintf(
    "Missing required packages: %s\nInstall with: install.packages(c(%s))",
    paste(missing_packages, collapse = ", "),
    paste(sprintf("'%s'", missing_packages), collapse = ", ")
  ))
}

library(sf)
library(dplyr)
library(jsonlite)
library(httr)

# ============================================================================
# Configuration
# ============================================================================

# Disable S2 spherical geometry (simplifies global polygon operations)
sf::sf_use_s2(FALSE)

# Data source
GPKG_URL <- "https://github.com/jhnwllr/gbif-country-polygons/raw/master/political.gpkg"
GPKG_FILENAME <- "political.gpkg"

# Processing parameters (user-configured)
BUFFER_DISTANCE <- 50000      # 50 km in meters
SIMPLIFY_TOLERANCE <- 0.05    # 0.05 degrees (~5.5 km at equator)

# Output paths
CACHE_DIR <- "cache"
OUTPUT_DIR <- "output"
GPKG_PATH <- file.path(CACHE_DIR, GPKG_FILENAME)
OUTPUT_FILE <- file.path(OUTPUT_DIR, "country_polygons.json")
FRONTEND_OUTPUT <- "../../ui/public/country_polygons.json"

# ============================================================================
# Setup Directories
# ============================================================================
message("========================================")
message("GBIF Country Polygon Generator")
message("========================================\n")

message("[Setup] Creating directories...")
dir.create(CACHE_DIR, showWarnings = FALSE, recursive = TRUE)
dir.create(OUTPUT_DIR, showWarnings = FALSE, recursive = TRUE)
message("  ✓ Directories ready\n")

# ============================================================================
# Step 1: Download political.gpkg
# ============================================================================
download_political_gpkg <- function() {
  message("[Step 1] Downloading political.gpkg...")
  
  if (file.exists(GPKG_PATH)) {
    message("  ✓ GPKG already exists, skipping download")
    message(sprintf("     Path: %s", GPKG_PATH))
    return(GPKG_PATH)
  }
  
  message(sprintf("  Downloading from: %s", GPKG_URL))
  
  tryCatch({
    download.file(GPKG_URL, GPKG_PATH, mode = "wb", quiet = FALSE)
    message("  ✓ Download complete")
    
    # Verify file was downloaded
    if (!file.exists(GPKG_PATH) || file.size(GPKG_PATH) == 0) {
      stop("Downloaded file is missing or empty")
    }
    
    file_size_mb <- file.size(GPKG_PATH) / 1024 / 1024
    message(sprintf("     File size: %.2f MB\n", file_size_mb))
    
  }, error = function(e) {
    stop(sprintf("Failed to download political.gpkg: %s", e$message))
  })
  
  return(GPKG_PATH)
}

# ============================================================================
# Step 2: Load and Process Countries
# ============================================================================
load_countries <- function(gpkg_path) {
  message("[Step 2] Loading country polygons from GPKG...")
  
  # List layers in GPKG
  layers <- st_layers(gpkg_path)
  message(sprintf("  Available layers: %s", paste(layers$name, collapse = ", ")))
  
  # Read the first layer (should be political boundaries)
  layer_name <- layers$name[1]
  message(sprintf("  Reading layer: %s", layer_name))
  
  countries <- st_read(gpkg_path, layer = layer_name, quiet = TRUE)
  message(sprintf("  ✓ Loaded %d country polygons", nrow(countries)))
  
  # Check geometry column name and standardize to "geometry"
  geom_col <- attr(countries, "sf_column")
  if (geom_col != "geometry") {
    message(sprintf("  Renaming geometry column from '%s' to 'geometry'", geom_col))
    # Extract geometry, rename column, rebuild sf object
    geom <- st_geometry(countries)
    countries <- st_drop_geometry(countries)
    countries$geometry <- geom
    countries <- st_as_sf(countries)
  }
  
  # Check CRS and transform to WGS84 if needed
  current_crs <- st_crs(countries)
  message(sprintf("  Current CRS: %s", current_crs$input))
  
  if (!identical(st_crs(countries), st_crs(4326))) {
    message("  Transforming to WGS84 (EPSG:4326)...")
    countries <- st_transform(countries, 4326)
  }
  
  message("  ✓ Polygons loaded and transformed to WGS84\n")
  return(countries)
}

# ============================================================================
# Step 3: Apply Buffer
# ============================================================================
apply_buffer <- function(countries) {
  message(sprintf("[Step 3] Applying +%d km buffer...", BUFFER_DISTANCE / 1000))
  
  # Buffer in meters (st_buffer uses CRS units)
  # For WGS84, we need to transform to a metric CRS, buffer, then transform back
  message("  Transforming to World Mercator for accurate buffering...")
  countries_merc <- st_transform(countries, 3395)  # World Mercator
  
  message(sprintf("  Applying %d meter buffer...", BUFFER_DISTANCE))
  
  # Apply buffer with error handling for each geometry
  buffered_geoms <- vector("list", nrow(countries_merc))
  failed_count <- 0
  
  for (i in seq_len(nrow(countries_merc))) {
    tryCatch({
      buffered_geoms[[i]] <- st_buffer(countries_merc$geometry[i], dist = BUFFER_DISTANCE)
    }, error = function(e) {
      # If buffer fails, use original geometry
      buffered_geoms[[i]] <- countries_merc$geometry[i]
      failed_count <<- failed_count + 1
    })
    
    if (i %% 50 == 0) {
      message(sprintf("    Processed %d / %d countries...", i, nrow(countries_merc)))
    }
  }
  
  if (failed_count > 0) {
    message(sprintf("  WARNING: Buffer failed for %d countries (using original geometry)", failed_count))
  }
  
  # Replace geometry column
  countries_merc$geometry <- do.call(c, buffered_geoms)
  countries_buffered <- st_sf(countries_merc)
  
  message("  Transforming back to WGS84...")
  countries_buffered <- st_transform(countries_buffered, 4326)
  
  message("  ✓ Buffer applied\n")
  return(countries_buffered)
}

# ============================================================================
# Step 3b: Fix Dateline Crossing
# ============================================================================
fix_dateline_crossing <- function(countries) {
  message("[Step 3b] Fixing dateline-crossing geometries...")
  
  dateline_count <- 0
  
  for (i in seq_len(nrow(countries))) {
    tryCatch({
      geom <- st_geometry(countries)[i]
      bbox <- st_bbox(geom)
      lon_span <- bbox["xmax"] - bbox["xmin"]
      
      # Check if geometry crosses dateline (spans > 180 degrees)
      if (lon_span > 180) {
        dateline_count <- dateline_count + 1
        
        # Extract coordinates as matrix (columns: X, Y, L1, L2, L3, ...)
        coords <- st_coordinates(geom)
        
        if (nrow(coords) > 0 && "X" %in% colnames(coords)) {
          # Get longitude values
          lngs <- coords[, "X"]
          
          # Calculate median longitude
          median_lng <- median(lngs, na.rm = TRUE)
          
          # Normalize coordinates: shift values >180° away from median
          adjusted_lngs <- lngs
          diff <- lngs - median_lng
          adjusted_lngs[diff > 180] <- lngs[diff > 180] - 360
          adjusted_lngs[diff < -180] <- lngs[diff < -180] + 360
          
          # Update X coordinates
          coords[, "X"] <- adjusted_lngs
          
          # Rebuild geometry based on type
          geom_type <- st_geometry_type(geom)
          
          if (geom_type == "MULTIPOLYGON") {
            # For MULTIPOLYGON, group by L1 (polygon) and L2 (ring)
            polygons <- lapply(unique(coords[, "L1"]), function(poly_id) {
              poly_coords <- coords[coords[, "L1"] == poly_id, , drop = FALSE]
              rings <- lapply(unique(poly_coords[, "L2"]), function(ring_id) {
                ring_coords <- poly_coords[poly_coords[, "L2"] == ring_id, c("X", "Y"), drop = FALSE]
                ring_coords  # Return matrix directly
              })
              rings  # Return list of rings
            })
            fixed_geom <- st_multipolygon(polygons)
            st_geometry(countries)[i] <- st_sfc(fixed_geom, crs = st_crs(geom))
          } else if (geom_type == "POLYGON") {
            # For POLYGON, group by L2 (ring)
            rings <- lapply(unique(coords[, "L2"]), function(ring_id) {
              ring_coords <- coords[coords[, "L2"] == ring_id, c("X", "Y"), drop = FALSE]
              ring_coords
            })
            fixed_geom <- st_polygon(rings)
            st_geometry(countries)[i] <- st_sfc(fixed_geom, crs = st_crs(geom))
          }
          # Note: If geom_type is neither MULTIPOLYGON nor POLYGON, keep original
        }
      }
    }, error = function(e) {
      # If fixing fails, keep original geometry (no change)
      message(sprintf("    Warning: Failed to fix geometry %d: %s", i, e$message))
    })
    
    if (i %% 50 == 0) {
      message(sprintf("    Processed %d / %d countries...", i, nrow(countries)))
    }
  }
  
  message(sprintf("  ✓ Fixed %d dateline-crossing geometries", dateline_count))
  message("  Note: Coordinates normalized to prevent cross-dateline straight lines\n")
  
  return(countries)
}

# ============================================================================
# Step 4: Simplify Geometry
# ============================================================================
simplify_geometry <- function(countries) {
  message(sprintf("[Step 4] Simplifying geometry (tolerance: %.2f degrees)...", SIMPLIFY_TOLERANCE))
  
  # Count vertices before simplification
  vertices_before <- sum(sapply(st_geometry(countries), function(g) nrow(st_coordinates(g))))
  message(sprintf("  Vertices before: %d", vertices_before))
  
  # Apply simplification with error handling
  simplified_geoms <- vector("list", nrow(countries))
  failed_count <- 0
  
  for (i in seq_len(nrow(countries))) {
    tryCatch({
      simplified_geoms[[i]] <- st_simplify(countries$geometry[i], dTolerance = SIMPLIFY_TOLERANCE)
    }, error = function(e) {
      # If simplification fails, use original geometry
      simplified_geoms[[i]] <- countries$geometry[i]
      failed_count <<- failed_count + 1
    })
    
    if (i %% 50 == 0) {
      message(sprintf("    Processed %d / %d countries...", i, nrow(countries)))
    }
  }
  
  if (failed_count > 0) {
    message(sprintf("  WARNING: Simplification failed for %d countries (using original geometry)", failed_count))
  }
  
  # Replace geometry column
  countries$geometry <- do.call(c, simplified_geoms)
  countries_simplified <- st_sf(countries)
  
  # Count vertices after simplification
  vertices_after <- sum(sapply(st_geometry(countries_simplified), function(g) nrow(st_coordinates(g))))
  reduction_pct <- (1 - vertices_after / vertices_before) * 100
  
  message(sprintf("  Vertices after: %d", vertices_after))
  message(sprintf("  Reduction: %.1f%%", reduction_pct))
  message("  ✓ Geometry simplified\n")
  
  return(countries_simplified)
}

# ============================================================================
# Step 5a: Fetch GBIF Country Names
# ============================================================================
fetch_gbif_countries <- function() {
  message("[Step 5a] Fetching GBIF country names...")
  
  gbif_api_url <- "https://api.gbif.org/v1/enumeration/country"
  
  tryCatch({
    response <- GET(gbif_api_url)
    
    if (status_code(response) != 200) {
      stop(sprintf("GBIF API returned status code %d", status_code(response)))
    }
    
    countries_json <- content(response, as = "text", encoding = "UTF-8")
    countries_list <- fromJSON(countries_json)
    
    # Extract ISO2 and title (official name)
    gbif_names <- data.frame(
      iso2_code = countries_list$iso2,
      gbif_name = countries_list$title,
      stringsAsFactors = FALSE
    )
    
    message(sprintf("  ✓ Fetched %d GBIF country names", nrow(gbif_names)))
    
    return(gbif_names)
    
  }, error = function(e) {
    message(sprintf("  ✗ Failed to fetch GBIF country names: %s", e$message))
    message("  Continuing with names from GPKG...")
    return(NULL)
  })
}

# ============================================================================
# Step 5b: Extract and Prepare Data
# ============================================================================
prepare_country_data <- function(countries, gbif_names = NULL) {
  message("[Step 5b] Preparing country data...")
  
  # Identify name and code columns
  col_names <- names(countries)
  message(sprintf("  Available columns: %s", paste(col_names, collapse = ", ")))
  
  # Try to find name column (various possible names)
  name_col <- NULL
  name_candidates <- c("name", "NAME", "ADMIN", "admin", "country", "COUNTRY", "NAME_EN", "name_en")
  for (candidate in name_candidates) {
    if (candidate %in% col_names) {
      name_col <- candidate
      break
    }
  }
  
  # Try to find ISO code column
  iso_col <- NULL
  iso_candidates <- c("isocountrycode2digit", "iso2", "ISO2", "iso_a2", "ISO_A2", "iso", "ISO")
  for (candidate in iso_candidates) {
    if (candidate %in% col_names) {
      iso_col <- candidate
      break
    }
  }
  
  message(sprintf("  Name column: %s", ifelse(is.null(name_col), "NOT FOUND", name_col)))
  message(sprintf("  ISO column: %s", ifelse(is.null(iso_col), "NOT FOUND", iso_col)))
  
  # Prepare data frame with GPKG names and ISO codes
  if (!is.null(name_col) && !is.null(iso_col)) {
    result <- countries %>%
      mutate(
        gpkg_name = as.character(.data[[name_col]]),
        iso2_code = as.character(.data[[iso_col]])
      ) %>%
      select(gpkg_name, iso2_code, geometry)
  } else if (!is.null(name_col)) {
    result <- countries %>%
      mutate(
        gpkg_name = as.character(.data[[name_col]]),
        iso2_code = ""
      ) %>%
      select(gpkg_name, iso2_code, geometry)
  } else {
    result <- countries %>%
      mutate(
        gpkg_name = paste0("Country_", row_number()),
        iso2_code = ""
      ) %>%
      select(gpkg_name, iso2_code, geometry)
  }
  
  # Clean up NA values in ISO codes
  result <- result %>%
    mutate(
      iso2_code = ifelse(is.na(iso2_code) | iso2_code == "", "", iso2_code),
      gpkg_name = ifelse(is.na(gpkg_name), paste0("Unknown_", row_number()), gpkg_name)
    )
  
  # Join with GBIF names if available
  if (!is.null(gbif_names)) {
    message("  Joining with GBIF country names...")
    result <- result %>%
      left_join(gbif_names, by = "iso2_code")
    
    # Use GBIF name if available, otherwise fall back to GPKG name
    result <- result %>%
      mutate(
        country_name = ifelse(!is.na(gbif_name) & nchar(gbif_name) > 0, gbif_name, gpkg_name),
        used_gbif = !is.na(gbif_name) & nchar(gbif_name) > 0
      )
    
    # Count matches before removing columns
    matched_count <- sum(result$used_gbif, na.rm = TRUE)
    
    # Select final columns
    result <- result %>%
      select(country_name, iso2_code, geometry)
    
    message(sprintf("  ✓ Matched %d countries with GBIF names", matched_count))
  } else {
    # No GBIF names available, use GPKG names
    result <- result %>%
      mutate(country_name = gpkg_name) %>%
      select(country_name, iso2_code, geometry)
    message("  Using GPKG names (GBIF names not available)")
  }
  
  message(sprintf("  ✓ Prepared %d country records\n", nrow(result)))
  return(result)
}

# ============================================================================
# Step 5c: Union Overlapping Polygons
# ============================================================================
union_polygons <- function(countries) {
  message("[Step 5c] Unioning overlapping polygons by ISO2 code...")
  
  initial_count <- nrow(countries)
  
  # Group by ISO2 code and union geometries
  countries_unioned <- countries %>%
    group_by(iso2_code, country_name) %>%
    summarise(
      geometry = st_union(geometry),
      .groups = "drop"
    )
  
  # Ensure it's an sf object
  if (!inherits(countries_unioned, "sf")) {
    countries_unioned <- st_as_sf(countries_unioned)
  }
  
  message(sprintf("  Before union: %d records", initial_count))
  message(sprintf("  After union: %d records", nrow(countries_unioned)))
  message(sprintf("  Reduced by: %d duplicates", initial_count - nrow(countries_unioned)))
  message("  ✓ Union complete\n")
  
  return(countries_unioned)
}

# ============================================================================
# Step 6: Export to JSON
# ============================================================================
export_to_json <- function(countries) {
  message("[Step 6] Exporting to JSON...")
  
  country_data <- list()
  
  for (i in seq_len(nrow(countries))) {
    geom <- countries$geometry[i]
    wkt <- st_as_text(geom)
    
    # Count vertices
    coords <- st_coordinates(geom)
    vertex_count <- nrow(coords)
    
    # Get country data
    name <- as.character(countries$country_name[i])
    iso2 <- as.character(countries$iso2_code[i])
    
    # Create identifier (prefer ISO code, fallback to name)
    identifier <- if (nchar(iso2) > 0) iso2 else gsub("[^A-Za-z0-9]", "_", name)
    
    country_data[[i]] <- list(
      identifier = identifier,
      type = "country",
      name = name,
      wkt = wkt,
      vertexCount = vertex_count,
      iso2 = iso2
    )
  }
  
  # Write to output directory
  json_str <- toJSON(country_data, pretty = TRUE, auto_unbox = TRUE)
  writeLines(json_str, OUTPUT_FILE)
  message(sprintf("  ✓ Saved to: %s", OUTPUT_FILE))
  
  # Copy to frontend public directory
  frontend_dir <- dirname(FRONTEND_OUTPUT)
  dir.create(frontend_dir, showWarnings = FALSE, recursive = TRUE)
  file.copy(OUTPUT_FILE, FRONTEND_OUTPUT, overwrite = TRUE)
  message(sprintf("  ✓ Copied to frontend: %s", FRONTEND_OUTPUT))
  
  # Summary statistics
  file_size_mb <- file.size(OUTPUT_FILE) / 1024 / 1024
  total_vertices <- sum(sapply(country_data, function(x) x$vertexCount))
  avg_vertices <- mean(sapply(country_data, function(x) x$vertexCount))
  max_vertices <- max(sapply(country_data, function(x) x$vertexCount))
  
  message("\n========================================")
  message("Export Summary")
  message("========================================")
  message(sprintf("Total countries: %d", length(country_data)))
  message(sprintf("Total vertices: %d", total_vertices))
  message(sprintf("Avg vertices per country: %.0f", avg_vertices))
  message(sprintf("Max vertices: %d", max_vertices))
  message(sprintf("File size: %.2f MB", file_size_mb))
  message("========================================\n")
  
  # Warn if file is large
  if (file_size_mb > 2) {
    message("WARNING: File size exceeds 2 MB")
    message("Consider increasing SIMPLIFY_TOLERANCE to reduce size\n")
  }
  
  return(country_data)
}

# ============================================================================
# Main Execution
# ============================================================================
main <- function() {
  start_time <- Sys.time()
  
  tryCatch({
    # Step 1: Download GPKG
    gpkg_path <- download_political_gpkg()
    
    # Step 2: Load countries
    countries <- load_countries(gpkg_path)
    
    # Step 3: Apply buffer
    countries <- apply_buffer(countries)
    
    # Step 3b: Fix dateline crossing
    countries <- fix_dateline_crossing(countries)
    
    # Step 4: Simplify geometry
    countries <- simplify_geometry(countries)
    
    # Step 5a: Fetch GBIF country names
    gbif_names <- fetch_gbif_countries()
    
    # Step 5b: Prepare data with GBIF names
    countries <- prepare_country_data(countries, gbif_names)
    
    # Step 5c: Union overlapping polygons
    countries <- union_polygons(countries)
    
    # Step 6: Export to JSON
    country_data <- export_to_json(countries)
    
    # Final summary
    end_time <- Sys.time()
    duration <- as.numeric(difftime(end_time, start_time, units = "secs"))
    
    message("========================================")
    message("COMPLETED SUCCESSFULLY")
    message("========================================")
    message(sprintf("Total time: %.1f seconds", duration))
    message(sprintf("Output file: %s", FRONTEND_OUTPUT))
    message("\nNext steps:")
    message("1. Verify country_polygons.json in ui/public/")
    message("2. Create CountrySelector React component")
    message("3. Integrate into SavedPolygons component")
    message("========================================\n")
    
  }, error = function(e) {
    message("\n========================================")
    message("ERROR")
    message("========================================")
    message(sprintf("Failed to generate country polygons: %s", e$message))
    message("========================================\n")
    quit(status = 1)
  })
}

# Run main function
main()
