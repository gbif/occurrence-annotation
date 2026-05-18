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
# Command-Line Arguments & Debug Mode
# ============================================================================
args <- commandArgs(trailingOnly = TRUE)
DEBUG_MODE <- FALSE
DEBUG_COUNTRY_CODE <- NULL

if (length(args) > 0) {
  if (args[1] == "--debug" && length(args) >= 2) {
    DEBUG_MODE <- TRUE
    DEBUG_COUNTRY_CODE <- toupper(args[2])
    message(sprintf("[DEBUG MODE] Will visualize country: %s\n", DEBUG_COUNTRY_CODE))
  } else {
    message("Usage: Rscript generate_country_polygons.R [--debug COUNTRY_CODE]")
    message("Example: Rscript generate_country_polygons.R --debug US")
    message("         Rscript generate_country_polygons.R --debug RU")
    message("         Rscript generate_country_polygons.R --debug FJ\n")
    stop("Invalid arguments")
  }
}

# ============================================================================
# Debug Plotting Functions
# ============================================================================
plot_country_stage <- function(country, stage_name, country_code) {
  # Get geometry info
  geom <- st_geometry(country)
  
  # Handle GEOMETRYCOLLECTION by extracting polygons
  geom_type <- st_geometry_type(geom, by_geometry = FALSE)
  if (geom_type == "GEOMETRYCOLLECTION") {
    geom <- st_collection_extract(geom, "POLYGON")
  }
  
  bbox <- st_bbox(geom)
  coords <- tryCatch({
    st_coordinates(geom)
  }, error = function(e) {
    # If st_coordinates fails, return empty matrix
    matrix(nrow = 0, ncol = 2)
  })
  
  # Get country name (might not exist in early stages)
  country_name <- if ("country_name" %in% colnames(country)) {
    as.character(country$country_name[1])
  } else if ("name" %in% colnames(country)) {
    as.character(country$name[1])
  } else {
    country_code
  }
  
  # Print info
  message(sprintf("\n[%s]", stage_name))
  message(sprintf("  Geometry type: %s", st_geometry_type(geom, by_geometry = FALSE)))
  message(sprintf("  Vertices: %d", nrow(coords)))
  message(sprintf("  Bounding box:"))
  message(sprintf("    Lat: %.2f to %.2f", bbox["ymin"], bbox["ymax"]))
  message(sprintf("    Lon: %.2f to %.2f", bbox["xmin"], bbox["xmax"]))
  message(sprintf("    Lon span: %.2f degrees", bbox["xmax"] - bbox["xmin"]))
  
  # Check for dateline crossing
  dateline_warning <- ""
  if (bbox["xmax"] - bbox["xmin"] > 180) {
    message("  ⚠ DATELINE CROSSING DETECTED")
    dateline_warning <- " [DATELINE CROSSING!]"
  }
  
  # Create plot - wrap in tryCatch
  tryCatch({
    plot(geom, 
         col = "lightblue", 
         border = "darkblue",
         main = sprintf("%s\n%s (%s)%s", stage_name, country_name, country_code, dateline_warning),
         xlab = "Longitude", 
         ylab = "Latitude",
         axes = TRUE,
         cex.main = 0.9)
    
    # Add grid
    grid()
    
    # Add dateline markers if relevant
    if (bbox["xmin"] < -170 || bbox["xmax"] > 170) {
      abline(v = c(-180, 180), col = "red", lty = 2, lwd = 2)
    }
  }, error = function(e) {
    plot.new()
    title(sprintf("%s\n(Plot error: %s)", stage_name, e$message))
  })
  
  # Show coordinate distribution
  if (nrow(coords) > 0) {
    message("  Longitude distribution:")
    lng_summary <- summary(coords[, "X"])
    print(lng_summary)
  }
}

plot_country_multi_stage <- function(stages_list, country_code) {
  message(sprintf("\n[DEBUG] Multi-stage visualization for: %s", country_code))
  message(sprintf("  Total stages: %d\n", length(stages_list)))
  
  # Set up multi-panel plot
  n_stages <- length(stages_list)
  n_cols <- min(3, n_stages)
  n_rows <- ceiling(n_stages / n_cols)
  
  par(mfrow = c(n_rows, n_cols), mar = c(3, 3, 3, 1))
  
  # Plot each stage
  for (stage_name in names(stages_list)) {
    country <- stages_list[[stage_name]]
    
    if (nrow(country) == 0) {
      plot.new()
      title(sprintf("%s\n(Not found)", stage_name))
      next
    }
    
    plot_country_stage(country, stage_name, country_code)
  }
  
  message("\n  Press Enter to continue...")
  invisible(readline())
}

extract_debug_country <- function(countries, country_code) {
  # Try to find country by ISO2 code in either column name
  country <- NULL
  
  # Check if iso2_code column exists (after prepare_country_data)
  if ("iso2_code" %in% colnames(countries)) {
    country <- countries[countries$iso2_code == country_code, ]
  } 
  # Check if isocountrycode2digit exists (before prepare_country_data)
  else if ("isocountrycode2digit" %in% colnames(countries)) {
    country <- countries[countries$isocountrycode2digit == country_code, ]
  }
  
  if (is.null(country) || nrow(country) == 0) {
    # Try to find by name matching as fallback
    message(sprintf("  ⚠ Country '%s' not found by ISO2 at this stage", country_code))
    return(data.frame())
  }
  
  return(country)
}

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
  
  # First, identify and mark dateline-crossing geometries
  dateline_flags <- logical(nrow(countries))
  for (i in seq_len(nrow(countries))) {
    bbox <- st_bbox(countries$geometry[i])
    lon_span <- bbox["xmax"] - bbox["xmin"]
    if (lon_span > 180) {
      dateline_flags[i] <- TRUE
    }
  }
  
  dateline_count <- sum(dateline_flags)
  if (dateline_count > 0) {
    message(sprintf("  ⚠ Found %d dateline-crossing geometries - these will NOT be buffered", dateline_count))
    message("    (Buffering in Mercator projection corrupts dateline geometries)")
  }
  
  # Buffer in meters (st_buffer uses CRS units)
  # For WGS84, we need to transform to a metric CRS, buffer, then transform back
  message("  Transforming to World Mercator for accurate buffering...")
  
  # Apply buffer with error handling for each geometry
  buffered_geoms <- vector("list", nrow(countries))
  failed_count <- 0
  skipped_count <- 0
  
  for (i in seq_len(nrow(countries))) {
    # Skip buffering for dateline-crossing geometries
    if (dateline_flags[i]) {
      buffered_geoms[[i]] <- countries$geometry[i]
      skipped_count <- skipped_count + 1
      next
    }
    
    tryCatch({
      # Transform to Mercator, buffer, transform back
      geom_merc <- st_transform(countries$geometry[i], 3395)
      buffered_merc <- st_buffer(geom_merc, dist = BUFFER_DISTANCE)
      buffered_geoms[[i]] <- st_transform(buffered_merc, 4326)
    }, error = function(e) {
      # If buffer fails, use original geometry
      buffered_geoms[[i]] <- countries$geometry[i]
      failed_count <<- failed_count + 1
    })
    
    if (i %% 50 == 0) {
      message(sprintf("    Processed %d / %d countries...", i, nrow(countries)))
    }
  }
  
  if (skipped_count > 0) {
    message(sprintf("  Skipped buffering for %d dateline-crossing geometries", skipped_count))
  }
  if (failed_count > 0) {
    message(sprintf("  WARNING: Buffer failed for %d countries (using original geometry)", failed_count))
  }
  
  # Replace geometry column
  countries$geometry <- do.call(c, buffered_geoms)
  countries_buffered <- st_sf(countries)
  
  message("  ✓ Buffer applied\n")
  return(countries_buffered)
}

# ============================================================================
# Helper: Shift Longitude of Geometry
# ============================================================================
shift_longitude <- function(geom, shift_amount) {
  # Helper function to recursively rebuild geometry with shifted coordinates
  shift_coords <- function(coords_matrix) {
    coords_matrix[, 1] <- coords_matrix[, 1] + shift_amount
    coords_matrix
  }
  
  geom_type <- st_geometry_type(geom, by_geometry = FALSE)
  crs <- st_crs(geom)
  
  if (geom_type == "POLYGON") {
    # Extract coordinates and shift
    coords_list <- st_coordinates(geom)
    rings <- split(coords_list[, c("X", "Y")], coords_list[, "L1"])
    shifted_rings <- lapply(rings, function(ring) {
      shift_coords(as.matrix(ring))
    })
    # Rebuild polygon
    return(st_sfc(st_polygon(shifted_rings), crs = crs))
    
  } else if (geom_type == "MULTIPOLYGON") {
    # Extract all coordinates
    coords_list <- st_coordinates(geom)
    # Group by L2 (polygon) and L3 (ring)
    polygons <- split(coords_list, coords_list[, "L2"])
    
    shifted_polygons <- lapply(polygons, function(poly_coords) {
      rings <- split(poly_coords[, c("X", "Y")], poly_coords[, "L3"])
      lapply(rings, function(ring) {
        shift_coords(as.matrix(ring))
      })
    })
    
    # Rebuild multipolygon
    return(st_sfc(st_multipolygon(shifted_polygons), crs = crs))
    
  } else if (geom_type == "GEOMETRYCOLLECTION") {
    # Extract polygons first
    poly_geom <- st_collection_extract(geom, "POLYGON")
    return(shift_longitude(poly_geom, shift_amount))
    
  } else {
    warning(sprintf("Unsupported geometry type for shifting: %s", geom_type))
    return(geom)
  }
}

# ============================================================================
# Step 4: Fix Dateline Crossing
# ============================================================================
fix_dateline_crossing <- function(countries) {
  message("[Step 4] Fixing dateline-crossing polygons...")
  message("  ℹ️  Splitting Antarctica into western/eastern pieces")
  message("     Other countries use original coordinates (render correctly)")
  
  crossing_count <- 0
  result_list <- vector("list", nrow(countries))
  result_idx <- 1
  
  for (i in seq_len(nrow(countries))) {
    country_geom <- countries$geometry[i]
    country_iso <- countries$iso2[i]
    bbox <- st_bbox(country_geom)
    lon_span <- bbox["xmax"] - bbox["xmin"]
    
    # Special handling for Antarctica: split into western and eastern pieces
    if (!is.na(country_iso) && country_iso == "AQ" && lon_span > 180) {
      crossing_count <- crossing_count + 1
      
      tryCatch({
        crs <- st_crs(country_geom)
        
        # Create bounding boxes for western and eastern hemispheres
        # Western: -180 to 0, Eastern: 0 to 180
        bbox_west <- st_bbox(c(xmin = -180, ymin = -90, xmax = 0, ymax = -57), crs = crs)
        bbox_east <- st_bbox(c(xmin = 0, ymin = -90, xmax = 180, ymax = -57), crs = crs)
        
        bbox_west_poly <- st_as_sfc(bbox_west)
        bbox_east_poly <- st_as_sfc(bbox_east)
        
        # Split into western and eastern pieces
        west_piece <- st_intersection(country_geom, bbox_west_poly)
        east_piece <- st_intersection(country_geom, bbox_east_poly)
        
        # Extract coordinates and manually build MULTIPOLYGON to keep pieces separate
        # This prevents st_union from merging them
        west_coords <- st_coordinates(west_piece)
        east_coords <- st_coordinates(east_piece)
        
        # Build polygon list manually
        polygons_list <- list()
        
        # Add western piece(s)
        if ("L1" %in% colnames(west_coords)) {
          # MULTIPOLYGON: split by L1
          west_polys <- split(as.data.frame(west_coords), west_coords[, "L1"])
          for (poly_df in west_polys) {
            rings <- split(poly_df[, c("X", "Y")], poly_df[, "L2"])
            ring_mats <- lapply(rings, as.matrix)
            polygons_list <- append(polygons_list, list(ring_mats))
          }
        } else {
          # Single POLYGON
          rings <- split(west_coords[, c("X", "Y")], west_coords[, "L1"])
          ring_mats <- lapply(rings, as.matrix)
          polygons_list <- append(polygons_list, list(ring_mats))
        }
        
        # Add eastern piece(s)
        if ("L1" %in% colnames(east_coords)) {
          # MULTIPOLYGON: split by L1
          east_polys <- split(as.data.frame(east_coords), east_coords[, "L1"])
          for (poly_df in east_polys) {
            rings <- split(poly_df[, c("X", "Y")], poly_df[, "L2"])
            ring_mats <- lapply(rings, as.matrix)
            polygons_list <- append(polygons_list, list(ring_mats))
          }
        } else {
          # Single POLYGON
          rings <- split(east_coords[, c("X", "Y")], east_coords[, "L1"])
          ring_mats <- lapply(rings, as.matrix)
          polygons_list <- append(polygons_list, list(ring_mats))
        }
        
        # Create MULTIPOLYGON from list
        multi_poly <- st_multipolygon(polygons_list)
        countries$geometry[i] <- st_sfc(multi_poly, crs = crs)
        
        result_list[[result_idx]] <- countries[i, ]
        result_idx <- result_idx + 1
        
        message(sprintf("    ✓ Split Antarctica into 2-piece MULTIPOLYGON (west: -180° to 0°, east: 0° to 180°)"))
        
      }, error = function(e) {
        # If splitting fails, keep original geometry
        message(sprintf("    ⚠ Failed to split Antarctica: %s", e$message))
        result_list[[result_idx]] <- countries[i, ]
        result_idx <<- result_idx + 1
      })
      
    } else if (FALSE && lon_span > 180) {  # Dateline fix disabled for other countries
      crossing_count <- crossing_count + 1
      
      tryCatch({
        # Get all coordinates to determine hemisphere
        coords <- st_coordinates(country_geom)
        lons <- coords[, "X"]
        
        # Find the median longitude to determine which hemisphere has more geometry
        lon_median <- median(lons, na.rm = TRUE)
        
        # Simple approach: shift all coordinates on the "wrong" side of dateline
        # For western hemisphere countries: shift positive longitudes (> 0) by -360
        # For eastern hemisphere countries: shift negative longitudes (< 0) by +360
        geom_type <- st_geometry_type(country_geom, by_geometry = FALSE)
        crs <- st_crs(country_geom)
        
        if (geom_type == "MULTIPOLYGON") {
          coords_full <- st_coordinates(country_geom)
          # coords_full has columns: X, Y, L1, L2, L3
          # L1 = polygon index, L2 = ring index within polygon, L3 = point index
          
          polygons <- split(as.data.frame(coords_full), coords_full[, "L1"])
          
          shifted_polygons <- lapply(polygons, function(poly_df) {
            rings <- split(poly_df[, c("X", "Y")], poly_df[, "L2"])
            lapply(rings, function(ring_df) {
              ring_mat <- as.matrix(ring_df)
              if (lon_median < 0) {
                # Western hemisphere: shift eastern coords westward
                ring_mat[ring_mat[, 1] > 0, 1] <- ring_mat[ring_mat[, 1] > 0, 1] - 360
              } else {
                # Eastern hemisphere: shift western coords eastward
                ring_mat[ring_mat[, 1] < 0, 1] <- ring_mat[ring_mat[, 1] < 0, 1] + 360
              }
              ring_mat
            })
          })
          
          countries$geometry[i] <- st_sfc(st_multipolygon(shifted_polygons), crs = crs)
          
        } else if (geom_type == "POLYGON") {
          coords_full <- st_coordinates(country_geom)
          # coords_full has columns: X, Y, L1, L2
          # L1 = ring index, L2 = point index
          
          rings <- split(coords_full[, c("X", "Y")], coords_full[, "L1"])
          
          shifted_rings <- lapply(rings, function(ring_coords) {
            ring_mat <- as.matrix(ring_coords)
            if (lon_median < 0) {
              ring_mat[ring_mat[, 1] > 0, 1] <- ring_mat[ring_mat[, 1] > 0, 1] - 360
            } else {
              ring_mat[ring_mat[, 1] < 0, 1] <- ring_mat[ring_mat[, 1] < 0, 1] + 360
            }
            ring_mat
          })
          
          countries$geometry[i] <- st_sfc(st_polygon(shifted_rings), crs = crs)
          
        } else if (geom_type == "GEOMETRYCOLLECTION") {
          poly_geom <- st_collection_extract(country_geom, "POLYGON")
          countries$geometry[i] <- poly_geom
        }
        
        message(sprintf("    Fixed %s (shifted coords across dateline)", countries$country_name[i]))
        
      }, error = function(e) {
        # If shifting fails, keep original geometry
        message(sprintf("    ⚠ Failed to fix %s: %s", countries$country_name[i], e$message))
      })
    } else {
      # All other countries: keep original geometry
      result_list[[result_idx]] <- countries[i, ]
      result_idx <- result_idx + 1
    }
    
    if (i %% 50 == 0) {
      message(sprintf("    Processed %d / %d countries...", i, nrow(countries)))
    }
  }
  
  # Remove NULL entries and combine results
  result_list <- result_list[!sapply(result_list, is.null)]
  countries_fixed <- do.call(rbind, result_list)
  
  message(sprintf("  ✓ Fixed %d dateline-crossing polygons\n", crossing_count))
  return(countries_fixed)
}

# ============================================================================
# Step 5: Simplify Geometry
# ============================================================================
simplify_geometry <- function(countries) {
  message(sprintf("[Step 5] Simplifying geometry (tolerance: %.2f degrees)...", SIMPLIFY_TOLERANCE))
  
  # Extract polygons from any GEOMETRYCOLLECTION geometries
  geom_types <- st_geometry_type(countries)
  if (any(geom_types == "GEOMETRYCOLLECTION")) {
    message("  Extracting polygons from GEOMETRYCOLLECTION...")
    # Extract only from GEOMETRYCOLLECTION, preserve other types (e.g. MULTIPOLYGON)
    for (i in seq_len(nrow(countries))) {
      if (st_geometry_type(countries$geometry[i]) == "GEOMETRYCOLLECTION") {
        countries$geometry[i] <- st_collection_extract(countries$geometry[i], "POLYGON")
      }
    }
  }
  
  # Count vertices before simplification
  vertices_before <- sum(sapply(st_geometry(countries), function(g) nrow(st_coordinates(g))))
  message(sprintf("  Vertices before: %d", vertices_before))
  
  # Apply simplification with error handling
  simplified_geoms <- vector("list", nrow(countries))
  failed_count <- 0
  
  for (i in seq_len(nrow(countries))) {
    tryCatch({
      # Skip simplification for Antarctica (AQ) - preserve MULTIPOLYGON structure
      iso2 <- as.character(countries$iso2_code[i])
      if (!is.na(iso2) && iso2 == "AQ") {
        simplified_geoms[[i]] <- countries$geometry[i]
      } else {
        simplified_geoms[[i]] <- st_simplify(countries$geometry[i], 
                                            dTolerance = SIMPLIFY_TOLERANCE, 
                                            preserveTopology = TRUE)
      }
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
# Step 3a: Fetch GBIF Country Names
# ============================================================================
fetch_gbif_countries <- function() {
  message("[Step 3a] Fetching GBIF country names from API...")
  
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
# Step 3b: Extract and Prepare Data
# ============================================================================
prepare_country_data <- function(countries, gbif_names = NULL) {
  message("[Step 3b] Preparing country data...")
  
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
  
  # Ensure result is an sf object
  if (!inherits(result, "sf")) {
    result <- st_as_sf(result)
  }
  
  return(result)
}

# ============================================================================
# Step 3c: Union Overlapping Polygons
# ============================================================================
union_polygons <- function(countries) {
  message("[Step 3c] Unioning overlapping polygons by ISO2 code (before dateline fix)...")
  
  initial_count <- nrow(countries)
  
  # Ensure it's an sf object with proper geometry column
  if (!inherits(countries, "sf")) {
    stop("Input must be an sf object")
  }
  
  # Make all geometries valid before union (fixes topology issues from buffering)
  message("  Making geometries valid before union...")
  
  # Apply st_make_valid to all countries EXCEPT Antarctica (skip to preserve MULTIPOLYGON)
  for (i in seq_len(nrow(countries))) {
    iso2 <- as.character(countries$iso2_code[i])
    if (!is.na(iso2) && iso2 == "AQ") {
      # Keep original geometry - don't apply st_make_valid (preserves MULTIPOLYGON structure)
      next
    } else {
      countries$geometry[i] <- st_make_valid(countries$geometry[i])
    }
  }
  
  # Group by ISO2 code and country name
  # Need to drop geometry temporarily to get unique combinations
  unique_keys <- countries %>%
    st_drop_geometry() %>%
    distinct(iso2_code, country_name)
  
  message(sprintf("  Found %d unique ISO2/name combinations", nrow(unique_keys)))
  
  # Union geometries for each unique ISO2/name combination
  result_list <- list()
  
  for (i in 1:nrow(unique_keys)) {
    iso2 <- unique_keys$iso2_code[i]
    name <- unique_keys$country_name[i]
    
    # Get all geometries with this ISO2/name
    subset <- countries[countries$iso2_code == iso2 & countries$country_name == name, ]
    
    if (nrow(subset) > 1) {
      # Special case: Skip union for Antarctica (AQ) - already split in dateline fix
      if (iso2 == "AQ") {
        # Take first entry (which should already be the MULTIPOLYGON from dateline fix)
        result_list[[i]] <- data.frame(
          iso2_code = iso2,
          country_name = name,
          geometry = st_geometry(subset[1, ]),
          stringsAsFactors = FALSE
        )
      } else {
        # Union multiple geometries for other countries
        message(sprintf("  Unioning %d geometries for %s (%s)", nrow(subset), name, iso2))
        unioned_geom <- st_union(st_geometry(subset))
        
        # st_union can create GEOMETRYCOLLECTION - extract only polygons
        if (st_geometry_type(unioned_geom, by_geometry = FALSE) == "GEOMETRYCOLLECTION") {
          unioned_geom <- st_collection_extract(unioned_geom, "POLYGON")
        }
        
        result_list[[i]] <- data.frame(
          iso2_code = iso2,
          country_name = name,
          geometry = unioned_geom,
          stringsAsFactors = FALSE
        )
      }
    } else {
      # Single geometry, keep as is
      result_list[[i]] <- data.frame(
        iso2_code = iso2,
        country_name = name,
        geometry = st_geometry(subset),
        stringsAsFactors = FALSE
      )
    }
    
    if (i %% 50 == 0) {
      message(sprintf("    Processed %d / %d unique countries...", i, nrow(unique_keys)))
    }
  }
  
  # Combine results
  countries_unioned <- do.call(rbind, result_list)
  countries_unioned <- st_as_sf(countries_unioned, crs = st_crs(countries))
  
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
  
  # Track used identifiers to handle duplicates
  identifier_counts <- list()
  
  for (i in seq_len(nrow(countries))) {
    tryCatch({
      geom <- countries$geometry[i]
      wkt <- st_as_text(geom)
      
      # Count vertices
      coords <- st_coordinates(geom)
      vertex_count <- nrow(coords)
      
      # Get country data
      name <- as.character(countries$country_name[i])
      iso2 <- as.character(countries$iso2_code[i])
      
      # Create base identifier (prefer ISO code, fallback to name)
      base_identifier <- if (nchar(iso2) > 0) iso2 else gsub("[^A-Za-z0-9]", "_", name)
      
      # Handle duplicate identifiers by appending index
      if (is.null(identifier_counts[[base_identifier]])) {
        identifier_counts[[base_identifier]] <- 1
        identifier <- base_identifier
      } else {
        identifier_counts[[base_identifier]] <- identifier_counts[[base_identifier]] + 1
        identifier <- paste0(base_identifier, "_", identifier_counts[[base_identifier]])
      }
      
      country_data[[i]] <- list(
        identifier = identifier,
        type = "country",
        name = name,
        wkt = wkt,
        vertexCount = vertex_count,
        iso2 = iso2
      )
      
    }, error = function(e) {
      message(sprintf("  ⚠ Failed to export country #%d: %s", i, e$message))
    })
    
    if (i %% 50 == 0) {
      message(sprintf("  Processed %d / %d countries...", i, nrow(countries)))
    }
  }
  
  # Remove NULL entries (failed exports)
  country_data <- country_data[!sapply(country_data, is.null)]
  
  message(sprintf("  ✓ Successfully exported %d countries", length(country_data)))
  
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
    # Initialize debug stages list
    debug_stages <- list()
    
    # Step 1: Download GPKG
    gpkg_path <- download_political_gpkg()
    
    # Step 2: Load countries
    countries <- load_countries(gpkg_path)
    
    # Debug: Capture stage 1 - After loading
    if (DEBUG_MODE && !is.null(DEBUG_COUNTRY_CODE)) {
      debug_stages[["1. After Loading"]] <- extract_debug_country(countries, DEBUG_COUNTRY_CODE)
    }
    
    # Step 3: Fetch GBIF country names
    # NOTE: Skipping buffering and union steps to preserve dateline-crossing polygons
    gbif_names <- fetch_gbif_countries()
    
    # Step 4: Prepare data with GBIF names
    countries <- prepare_country_data(countries, gbif_names)
    
    # Debug: Capture stage 2 - After preparing data
    if (DEBUG_MODE && !is.null(DEBUG_COUNTRY_CODE)) {
      debug_stages[["2. After Preparing Data"]] <- extract_debug_country(countries, DEBUG_COUNTRY_CODE)
    }
    
    # Step 5: Fix dateline crossing on individual polygons
    countries <- fix_dateline_crossing(countries)
    
    # Debug: Capture stage 3 - After dateline fix
    if (DEBUG_MODE && !is.null(DEBUG_COUNTRY_CODE)) {
      debug_stages[["3. After Dateline Fix"]] <- extract_debug_country(countries, DEBUG_COUNTRY_CODE)
    }
    
    # Step 6: Union polygons by ISO2 code to create multipolygons
    countries <- union_polygons(countries)
    
    # Debug: Capture stage 4 - After union
    if (DEBUG_MODE && !is.null(DEBUG_COUNTRY_CODE)) {
      debug_stages[["4. After Union"]] <- extract_debug_country(countries, DEBUG_COUNTRY_CODE)
    }
    
    # If in debug mode, plot all stages and exit
    if (DEBUG_MODE && !is.null(DEBUG_COUNTRY_CODE)) {
      # Apply simplification to see final result
      countries_simplified <- simplify_geometry(countries)
      debug_stages[["5. After Simplification"]] <- extract_debug_country(countries_simplified, DEBUG_COUNTRY_CODE)
      
      # Plot all stages
      plot_country_multi_stage(debug_stages, DEBUG_COUNTRY_CODE)
      message("\n[DEBUG] Exiting after visualization")
      return(invisible(NULL))
    }
    
    # Step 6: Union polygons by ISO2 code
    countries <- union_polygons(countries)
    
    # Step 7: Simplify geometry
    countries <- simplify_geometry(countries)
    
    # Step 8: Export to JSON
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
