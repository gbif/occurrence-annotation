#' Clean a GBIF download of suspicious records using complex rules
#'
#' @param d a GBIF download in DWCA format 
#' @param rm_suspicious removes records with suspicious annotations
#' @param handle_conflicts how to handle conflicting annotations
#'
#' @return A cleaned download `data.frame()`
#' @description
#' Removes records that have been marked as suspicious by annotation users using complex rules.
#' Only filters based on SUSPICIOUS annotations, ignoring other annotation types.
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
#' d <- occ_download_get('0051416-241126133413365') %>%
#'  occ_download_import()
#' 
#' clean_download(d) 
#' }
#' 
#' 
clean_download <- function(d,
                           rm_suspicious = TRUE,
                           handle_conflicts = "favor_suspicious") {
  
  # Prepare the original data with coordinates and unique identifier
  d_org <- d |>
    dplyr::filter(!is.na(decimalLongitude), !is.na(decimalLatitude)) |>
    dplyr::mutate(
      lon = decimalLongitude,
      lat = decimalLatitude,
      record_id = paste(taxonKey, decimalLatitude, decimalLongitude, sep = "_")
    ) 
  
  # Prepare simplified dataset for rule checking
  d_clean <- d_org |>
    dplyr::select(
      decimalLongitude,
      decimalLatitude,
      taxonKey,
      record_id,
      lon,
      lat
    ) |>
    unique()
  
  # Get suspicious annotations for all taxon keys in the dataset
  suspicious_annotations <- get_suspicious_annotations(d_clean)
  
  # Merge annotations back with original data
  out <- d_org |>
    dplyr::left_join(suspicious_annotations, by = "record_id") |>
    dplyr::mutate(
      is_suspicious = ifelse(is.na(is_suspicious), FALSE, is_suspicious)
    )
  
  # Handle conflicts if specified
  if (handle_conflicts == "favor_suspicious" && any(out$has_conflict, na.rm = TRUE)) {
    message("Handling conflicts by favoring suspicious annotations")
    out <- out |>
      dplyr::group_by(record_id) |>
      dplyr::summarise(
        is_suspicious = any(is_suspicious, na.rm = TRUE),
        has_conflict = n() > 1,
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

get_suspicious_annotations <- function(d) {
  # Get unique taxon keys from the dataset
  unique_taxon_keys <- unique(d$taxonKey)
  
  # Fetch all rules for the taxon keys in the dataset
  all_rules <- get_rule() |>
    dplyr::filter(
      taxonKey %in% unique_taxon_keys,
      annotation == "SUSPICIOUS",
      is.na(deleted)  # Only include non-deleted rules
    )
  
  if (nrow(all_rules) == 0) {
    # No suspicious rules found, return data with no suspicious annotations
    return(d |>
      dplyr::select(record_id) |>
      dplyr::mutate(
        is_suspicious = FALSE,
        has_conflict = FALSE
      ))
  }
  
  # Convert occurrence data to spatial points
  d_sf <- d |>
    sf::st_as_sf(coords = c("decimalLongitude", "decimalLatitude"), crs = 4326)
  
  # Process each rule
  annotation_results <- all_rules |>
    dplyr::group_split(id) |>
    purrr::map_dfr(~ {
      rule <- .x
      
      # Detect if this is an inverted polygon (global extent with holes)
      is_inverted <- FALSE
      tryCatch({
        geom_sf <- sf::st_as_sfc(rule$geometry, crs = 4326)
        if (length(geom_sf) > 0) {
          coords <- sf::st_coordinates(geom_sf[[1]])
          # Check if polygon has multiple rings (L2 column indicates ring number)
          if ("L2" %in% colnames(coords) && max(coords[,"L2"]) > 1) {
            # Get outer ring coordinates (L2 == 1)
            outer_ring <- coords[coords[,"L2"] == 1, c("X", "Y")]
            x_range <- max(outer_ring[,"X"]) - min(outer_ring[,"X"])
            y_range <- max(outer_ring[,"Y"]) - min(outer_ring[,"Y"])
            # Consider inverted if outer ring spans most of the globe (>300° lon, >150° lat)
            is_inverted <- x_range > 300 && y_range > 150
          }
        }
      }, error = function(e) {
        # If geometry parsing fails, assume it's a normal polygon
        message("Geometry parsing failed for rule ", rule$id, ": ", e$message)
        is_inverted <- FALSE
      })
      
      # Convert WKT geometry to sf polygon
      polygon <- rule |>
        dplyr::mutate(geometry = sf::st_as_sfc(geometry, crs = 4326)) |>
        sf::st_sf() |>
        sf::st_geometry() |>
        sf::st_make_valid()
      
      # Determine which points are within the polygon
      # For both normal and inverted polygons, st_within() gives us what we need:
      # - Normal polygons: TRUE if point is inside the polygon
      # - Inverted polygons (global with holes): TRUE if point is in the solid part 
      #   (not in the holes), FALSE if point is in a hole
      # This is the correct behavior for both cases
      within <- as.vector(sf::st_within(d_sf, polygon, sparse = FALSE))
      
      # Return results for this rule
      d |>
        dplyr::mutate(
          is_suspicious = within,
          rule_id = rule$id,
          taxon_key_rule = rule$taxonKey
        ) |>
        dplyr::filter(is_suspicious, taxonKey == rule$taxonKey) |>
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
        has_conflict = n() > 1,
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
  cat("─ Cleaning Summary ────────────────────────\n")
  cat("Number of records in original download: ", attr(x, "n_records_org"), "\n")
  cat("Number of suspicious records removed: ", attr(x, "n_records_removed"), "\n")
  cat("Percentage of records removed: ", attr(x, "n_records_removed_pct"), "%\n")
  cat("Number of records remaining: ", nrow(x), "\n")
}



