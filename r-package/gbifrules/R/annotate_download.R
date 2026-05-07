#' Annotate a GBIF download with annotation terms from rules
#'
#' @param d a GBIF download in DWCA format 
#' @param project_id optional project ID(s) to filter rules by specific project(s). Can be a single ID or vector of IDs.
#'
#' @return The original download `data.frame()` with an added `annotations` column
#' @description
#' Adds an "annotations" column to the download containing annotation terms (SUSPICIOUS, NATIVE, INTRODUCED, etc.)
#' from matching rules. Multiple annotations for the same record are semicolon-delimited.
#' Records without any matching annotations will have NA in the annotations column.
#' If project_id is provided, only rules belonging to those project(s) will be used.
#' 
#' @export
#'
#' @examples \dontrun{
#' library(rgbif)
#' # Download and annotate
#' d <- occ_download_get('0004693-260120142942310') %>%
#'   occ_download_import()
#' 
#' # Annotate with all available rules
#' annotated <- annotate_download(d)
#' 
#' # Annotate using only rules from a specific project
#' annotated <- annotate_download(d, project_id = 1)
#' 
#' # Annotate using rules from multiple projects
#' annotated <- annotate_download(d, project_id = c(1, 2, 3))
#' }
annotate_download <- function(d, project_id = NULL) {
  
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
  
  # Get all annotations for all taxon keys in the dataset
  all_annotations <- get_all_annotations(d_clean, project_id = project_id)
  
  # Merge annotations back with original data
  out <- d_org |>
    dplyr::left_join(all_annotations, by = "record_id") |>
    dplyr::select(-record_id, -lon, -lat)
  
  return(out)
}

get_all_annotations <- function(d, project_id = NULL) {
  # Get unique taxon keys from the dataset
  unique_taxon_keys <- unique(d$taxonKey)
  
  # Fetch all rules for the taxon keys in the dataset
  # If project_id is specified, filter by projectId parameter
  if (!is.null(project_id)) {
    # Fetch rules for each project and combine them
    all_rules <- purrr::map_dfr(project_id, function(pid) {
      rules <- get_rule(projectId = pid)
      # Ensure geometry is character (not list from bind_rows)
      if (nrow(rules) > 0 && is.list(rules$geometry)) {
        rules$geometry <- as.character(rules$geometry)
      }
      rules
    }) |>
      dplyr::filter(
        taxonKey %in% unique_taxon_keys,
        is.na(deleted)  # Only include non-deleted rules
      ) |>
      dplyr::distinct()  # Remove any duplicate rules if a rule belongs to multiple projects
  } else {
    all_rules <- get_rule() |>
      dplyr::filter(
        taxonKey %in% unique_taxon_keys,
        is.na(deleted)  # Only include non-deleted rules
      )
  }
  
  if (nrow(all_rules) == 0) {
    # No rules found, return data with NA annotations
    return(d |>
      dplyr::select(record_id) |>
      dplyr::mutate(annotations = NA_character_))
  }
  
  # Ensure geometry is character (in case map_dfr created list-column)
  if (is.list(all_rules$geometry)) {
    all_rules$geometry <- purrr::map_chr(all_rules$geometry, ~ {
      if (is.null(.x)) return(NA_character_)
      if (length(.x) == 0) return(NA_character_)
      as.character(.x[[1]])
    })
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
      d_sf_for_rule <- d_sf[d_sf$taxonKey == rule$taxonKey, ]
      
      # Determine which points (for this taxon) are within the polygon
      within <- as.vector(sf::st_within(d_sf_for_rule, polygon, sparse = FALSE))
      
      # Restore s2 setting
      suppressMessages(sf::sf_use_s2(old_s2))
      
      # Apply basisOfRecord filtering if specified in the rule
      records_for_rule <- d |>
        dplyr::filter(taxonKey == rule$taxonKey) |>
        dplyr::mutate(
          is_matching_spatial = within,
          rule_id = rule$id,
          rule_annotation = rule$annotation
        )
      
      # Apply basisOfRecord filter if specified in the rule AND the data has basisOfRecord column
      # Check if rule has actual basisOfRecord values (not NULL, not empty, not just NAs)
      # Handle both character vectors and list-columns from bind_rows()
      rule_basis_values <- character(0)
      if (!is.null(rule$basisOfRecord) && !all(is.na(rule$basisOfRecord))) {
        # Could be a character vector, a list, or a single value
        basis_raw <- rule$basisOfRecord
        if (is.list(basis_raw)) {
          rule_basis_values <- unlist(basis_raw)
        } else {
          rule_basis_values <- basis_raw
        }
        # Remove NA values and empty strings
        rule_basis_values <- rule_basis_values[!is.na(rule_basis_values) & nchar(rule_basis_values) > 0]
      }
      
      has_basis_filter <- length(rule_basis_values) > 0 && "basisOfRecord" %in% colnames(records_for_rule)
      
      if (has_basis_filter) {
        # Apply basisOfRecord filtering
        if (isTRUE(rule$basisOfRecordNegated)) {
          # Negated: rule applies to records NOT in the basisOfRecord list
          records_for_rule <- records_for_rule |>
            dplyr::mutate(
              is_matching_basis = is.na(basisOfRecord) | !(basisOfRecord %in% rule_basis_values)
            )
        } else {
          # Normal: rule applies to records IN the basisOfRecord list
          records_for_rule <- records_for_rule |>
            dplyr::mutate(
              is_matching_basis = !is.na(basisOfRecord) & (basisOfRecord %in% rule_basis_values)
            )
        }
        
        # Combined filter: both spatial AND basisOfRecord conditions must be met
        records_for_rule <- records_for_rule |>
          dplyr::mutate(is_matching = is_matching_spatial & is_matching_basis)
      } else {
        # No basisOfRecord filter, only spatial
        records_for_rule <- records_for_rule |>
          dplyr::mutate(is_matching = is_matching_spatial)
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
            is_matching_dataset = !is.na(datasetKey) & (datasetKey == rule_dataset_key),
            # Combine with existing is_matching (from spatial + basisOfRecord)
            is_matching = is_matching & is_matching_dataset
          )
      }
      
      # Return results for this rule - only matching records with their annotation
      records_for_rule |>
        dplyr::filter(is_matching) |>
        dplyr::select(record_id, rule_annotation)
    })
  
  # Combine results and create semicolon-delimited annotation strings
  if (nrow(annotation_results) == 0) {
    # No annotations found
    summary_results <- d |>
      dplyr::select(record_id) |>
      dplyr::mutate(annotations = NA_character_)
  } else {
    # Group by record_id and combine annotations with semicolons
    summary_results <- annotation_results |>
      dplyr::group_by(record_id) |>
      dplyr::summarise(
        annotations = paste(unique(rule_annotation), collapse = ";"),
        .groups = "drop"
      ) |>
      dplyr::right_join(
        d |> dplyr::select(record_id),
        by = "record_id"
      )
  }
  
  return(summary_results)
}
