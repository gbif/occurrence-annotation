#' Clean a GBIF download of suspicious records using complex rules
#'
#' @param d a GBIF download in DWCA format 
#' @param rm_suspicious removes records with suspicious annotations
#' @param handle_conflicts how to handle conflicting annotations
#' @param project_id optional project ID(s) to filter rules by specific project(s). Can be a single ID or vector of IDs.
#'
#' @return A cleaned download `data.frame()`
#' @description
#' Removes records that have been marked as suspicious by annotation users using complex rules.
#' Only filters based on SUSPICIOUS annotations, ignoring other annotation types.
#' If project_id is provided, only rules belonging to those project(s) will be used.
#' 
#' 
#' @export
#'
#' @examples \dontrun{
#' library(rgbif)
#' # End to end example with GBIF download and cleaning
#' 
#' # Ambystoma mexicanum
#' occ_download(
#' pred(taxonKey,"2431950"),
#' pred_default()
#' format = "SIMPLE_CSV"
#' )
#' 
#' # Download and clean
#' d <- occ_download_get('0004693-260120142942310') %>%
#'  occ_download_import()
#' 
# clean_download(d) 
#' 
#' # Clean using only rules from a specific project
#' clean_download(d, project_id = 1)
#' 
#' # Clean using rules from multiple projects
#' clean_download(d, project_id = c(1, 2, 3))
#' }
#' 
#' 
clean_download <- function(d,
                           rm_suspicious = TRUE,
                           handle_conflicts = "favor_suspicious",
                           project_id = NULL) {
  
  # Prepare the original data with coordinates and unique identifier
  d_org <- d |>
    dplyr::filter(!is.na(decimalLongitude), !is.na(decimalLatitude)) |>
    dplyr::mutate(
      lon = decimalLongitude,
      lat = decimalLatitude,
      # Create unique record_id including basisOfRecord if present to handle duplicates
      record_id = if ("basisOfRecord" %in% colnames(d)) {
        paste(taxonKey, decimalLatitude, decimalLongitude, 
              ifelse(is.na(basisOfRecord), "NA", basisOfRecord), 
              dplyr::row_number(), sep = "_")
      } else {
        paste(taxonKey, decimalLatitude, decimalLongitude, dplyr::row_number(), sep = "_")
      }
    ) 
  
  # Prepare simplified dataset for rule checking
  # Include basisOfRecord and datasetKey if they exist in the data
  d_clean <- d_org |>
    dplyr::select(
      decimalLongitude,
      decimalLatitude,
      taxonKey,
      record_id,
      lon,
      lat,
      # Include basisOfRecord and datasetKey if present
      dplyr::any_of(c("basisOfRecord", "datasetKey"))
    ) |>
    unique()
  
  # Get suspicious annotations for all taxon keys in the dataset
  suspicious_annotations <- get_suspicious_annotations(d_clean, project_id = project_id)
  
  # Merge annotations back with original data
  out <- d_org |>
    dplyr::left_join(suspicious_annotations, by = "record_id") |>
    dplyr::mutate(
      is_suspicious = ifelse(is.na(is_suspicious), FALSE, is_suspicious)
    )
  
  # Handle conflicts if specified
  if (handle_conflicts == "favor_suspicious" && any(out$has_conflict, na.rm = TRUE)) {
    # message("Handling conflicts by favoring suspicious annotations")
    out <- out |>
      dplyr::group_by(record_id) |>
      dplyr::summarise(
        is_suspicious = any(is_suspicious, na.rm = TRUE),
        has_conflict = dplyr::n() > 1,
        .groups = "drop"
      ) |>
      # Join back to the original download by record_id to restore original columns
      dplyr::left_join(
        d_org |> dplyr::distinct(),
        by = "record_id"
      )
  }
  
  # Filter out suspicious records if requested
  if (rm_suspicious) {
    out <- out |>
      dplyr::filter(!is_suspicious)
  }
  
  # Clean up temporary columns
  out <- out |>
    dplyr::select(-record_id, -lon, -lat)
  
  # Compute statistics
  n_records_org <- nrow(d_org)
  n_records_removed <- nrow(d_org) - nrow(out)
  n_records_removed_pct <- round((n_records_removed / n_records_org) * 100, 4)
  
  # Create annotated download object with attributes
  rule_download <- structure(out, class = c("rule_download", class(out)))
  attr(rule_download, "n_records_removed") <- n_records_removed
  attr(rule_download, "n_records_removed_pct") <- n_records_removed_pct
  attr(rule_download, "n_records_org") <- n_records_org
  
  rule_download
}

get_suspicious_annotations <- function(d, project_id = NULL) {
  # Get unique taxon keys from the dataset
  unique_taxon_keys <- unique(d$taxonKey)
  
  # Fetch all rules for the taxon keys in the dataset
  # If project_id is specified, filter by projectId parameter
  if (!is.null(project_id)) {
    # Fetch rules for each project and combine them
    all_rules <- purrr::map_dfr(project_id, function(pid) {
      get_rule(projectId = pid)
    }) |>
      dplyr::filter(
        taxonKey %in% unique_taxon_keys,
        annotation == "SUSPICIOUS",
        is.na(deleted)  # Only include non-deleted rules
      ) |>
      dplyr::distinct()  # Remove any duplicate rules if a rule belongs to multiple projects
  } else {
    all_rules <- get_rule() |>
      dplyr::filter(
        taxonKey %in% unique_taxon_keys,
        annotation == "SUSPICIOUS",
        is.na(deleted)  # Only include non-deleted rules
      )
  }
  
  if (nrow(all_rules) == 0) {
    # No suspicious rules found, return data with no suspicious annotations
    return(d |>
      dplyr::select(record_id) |>
      dplyr::mutate(
        is_suspicious = FALSE,
        has_conflict = FALSE
      ))
  }
  
  # Convert occurrence data to spatial points and transform to projected CRS
  d_sf <- d |>
    sf::st_as_sf(coords = c("decimalLongitude", "decimalLatitude"), crs = 4326) |>
    sf::st_transform(crs = 3857)  # Web Mercator - good for global data
  
  # Process each rule
  annotation_results <- all_rules |>
    dplyr::group_split(id) |>
    purrr::map_dfr(~ {
      rule <- .x
      
      # Detect if this is an inverted polygon (global extent with holes) BEFORE st_make_valid
      is_inverted <- FALSE
      tryCatch({
        # Parse geometry directly from WKT to check original structure
        geom_sf <- sf::st_as_sfc(rule$geometry, crs = 4326)
        if (length(geom_sf) > 0) {
          coords <- sf::st_coordinates(geom_sf[[1]])
          # Check if polygon has multiple rings (L1 column indicates ring number for polygon parts)
          if ("L1" %in% colnames(coords) && max(coords[,"L1"]) > 1) {
            # Get outer ring coordinates (L1 == 1)
            outer_ring <- coords[coords[,"L1"] == 1, c("X", "Y")]
            x_range <- max(outer_ring[,"X"]) - min(outer_ring[,"X"])
            y_range <- max(outer_ring[,"Y"]) - min(outer_ring[,"Y"])
            # Consider inverted if outer ring spans most of the globe (>300° lon, >150° lat)
            is_inverted <- x_range > 300 && y_range > 150
            # message("Rule ", rule$id, " - Inverted polygon detected (X: ", round(x_range, 1), "°, Y: ", round(y_range, 1), "°)")
          }
        }
      }, error = function(e) {
        # If geometry parsing fails, assume it's a normal polygon
        message("Geometry parsing failed for rule ", rule$id, ": ", e$message)
        is_inverted <- FALSE
      })

      # Convert WKT geometry to sf polygon
      # Disable s2 for better handling of global polygons with holes
      old_s2 <- sf::sf_use_s2()
      suppressMessages(sf::sf_use_s2(FALSE))
      
      polygon <- rule |>
        dplyr::mutate(geometry = sf::st_as_sfc(geometry, crs = 4326)) |>
        sf::st_sf() |>
        sf::st_geometry() |>
        sf::st_make_valid() |>
        sf::st_transform(crs = 3857)  # Transform to same CRS as points
      
      # Filter points to only those matching this rule's taxonKey
      # This ensures the spatial result has the same length as records_for_rule
      d_sf_for_rule <- d_sf[d_sf$taxonKey == rule$taxonKey, ]
      
      # Determine which points (for this taxon) are within the polygon
      within <- as.vector(sf::st_within(d_sf_for_rule, polygon, sparse = FALSE))
      
      # Restore s2 setting
      suppressMessages(sf::sf_use_s2(old_s2))
      

      
      # For inverted polygons, the logic is different:
      # - st_within() returns TRUE for points in the solid part (should be suspicious)
      # - st_within() returns FALSE for points in holes (should NOT be suspicious)
      # For normal polygons:
      # - st_within() returns TRUE for points inside (should be suspicious)
      # - st_within() returns FALSE for points outside (should NOT be suspicious)
      # So the logic is the same for both cases: within = suspicious
      
      # Debug info can be enabled if needed:
      # message("Rule ", rule$id, " (inverted: ", is_inverted, ") processed ", 
      #        sum(d_sf$taxonKey == rule$taxonKey), " points")
      
      # Apply basisOfRecord filtering if specified in the rule
      records_for_rule <- d |>
        dplyr::filter(taxonKey == rule$taxonKey) |>
        dplyr::mutate(
          is_suspicious_spatial = within,
          rule_id = rule$id,
          taxon_key_rule = rule$taxonKey
        )
      
      # Apply basisOfRecord filter if specified in the rule AND the data has basisOfRecord column
      # Check if rule has actual basisOfRecord values (not NULL, not empty, not just NAs)
      rule_basis_values <- if (!is.null(rule$basisOfRecord)) unlist(rule$basisOfRecord) else character(0)
      rule_basis_values <- rule_basis_values[!is.na(rule_basis_values)]  # Remove any NA values
      
      has_basis_filter <- length(rule_basis_values) > 0 && "basisOfRecord" %in% colnames(records_for_rule)
      
      if (has_basis_filter) {
        # Apply basisOfRecord filtering
        if (isTRUE(rule$basisOfRecordNegated)) {
          # Negated: rule applies to records NOT in the basisOfRecord list
          records_for_rule <- records_for_rule |>
            dplyr::mutate(
              is_suspicious_basis = is.na(basisOfRecord) | !(basisOfRecord %in% rule_basis_values)
            )
        } else {
          # Normal: rule applies to records IN the basisOfRecord list
          records_for_rule <- records_for_rule |>
            dplyr::mutate(
              is_suspicious_basis = !is.na(basisOfRecord) & (basisOfRecord %in% rule_basis_values)
            )
        }
        
        # Combined filter: both spatial AND basisOfRecord conditions must be met
        records_for_rule <- records_for_rule |>
          dplyr::mutate(is_suspicious = is_suspicious_spatial & is_suspicious_basis)
      } else {
        # No basisOfRecord filter, only spatial
        records_for_rule <- records_for_rule |>
          dplyr::mutate(is_suspicious = is_suspicious_spatial)
      }
      
      # Apply datasetKey filter if specified in the rule AND the data has datasetKey column
      # Guard against NA values which would cause nchar() to return NA
      has_dataset_filter <- !is.null(rule$datasetKey) && 
                            !is.na(rule$datasetKey) && 
                            nchar(rule$datasetKey) > 0 && 
                            "datasetKey" %in% colnames(records_for_rule)
      
      if (has_dataset_filter) {
        # datasetKey is a single value (UUID string), not an array like basisOfRecord
        rule_dataset_key <- rule$datasetKey
        
        # Filter: rule applies only to records from the specified dataset
        records_for_rule <- records_for_rule |>
          dplyr::mutate(
            is_suspicious_dataset = !is.na(datasetKey) & (datasetKey == rule_dataset_key),
            # Combine with existing is_suspicious (from spatial + basisOfRecord)
            is_suspicious = is_suspicious & is_suspicious_dataset
          )
      }
      
      # Return results for this rule
      records_for_rule |>
        dplyr::filter(is_suspicious) |>
        dplyr::select(record_id, is_suspicious, rule_id)
    })
  
  # Combine results and handle conflicts
  if (nrow(annotation_results) == 0) {
    # No suspicious annotations found
    summary_results <- d |>
      dplyr::select(record_id) |>
      dplyr::mutate(
        is_suspicious = FALSE,
        has_conflict = FALSE
      )
  } else {
    # Summarize annotations per record
    summary_results <- annotation_results |>
      dplyr::group_by(record_id) |>
      dplyr::summarise(
        is_suspicious = any(is_suspicious, na.rm = TRUE),
        has_conflict = dplyr::n() > 1,
        .groups = "drop"
      ) |>
      dplyr::right_join(
        d |> dplyr::select(record_id),
        by = "record_id"
      ) |>
      dplyr::mutate(
        is_suspicious = ifelse(is.na(is_suspicious), FALSE, is_suspicious),
        has_conflict = ifelse(is.na(has_conflict), FALSE, has_conflict)
      )
  }
  
  return(summary_results)
}

#' @method print rule_download
#' @export
print.rule_download <- function(x, ...) {
  # Extract attributes

  n_org <- attr(x, "n_records_org")
  n_removed <- attr(x, "n_records_removed")
  n_pct <- attr(x, "n_records_removed_pct")
  n_remaining <- nrow(x)
  

  # Header
  cli::cli_h1("Cleaning Summary")
  
  # Format numbers with commas for display
  n_org_fmt <- format(n_org, big.mark = ",")
  n_removed_fmt <- format(n_removed, big.mark = ",")
  n_remaining_fmt <- format(n_remaining, big.mark = ",")
  
  # Use cli for formatted output
  cli::cli_bullets(c(
    "*" = "Records in original download: {.strong {n_org_fmt}}",
    "x" = "Suspicious records removed:   {.strong {n_removed_fmt}} ({n_pct}%)",
    "v" = "Records remaining:            {.strong {n_remaining_fmt}}"
  ))
  
  # Progress bar style visual
  if (n_org > 0) {
    bar_width <- 30
    kept_pct <- (n_remaining / n_org)
    kept_bars <- round(kept_pct * bar_width)
    removed_bars <- bar_width - kept_bars
    
    bar <- paste0(
      cli::col_green(strrep("\u2588", kept_bars)),
      cli::col_red(strrep("\u2588", removed_bars))
    )
    cat("\n")
    cli::cli_text("{.emph Kept}: {bar}")
  }
  
  invisible(x)
}



