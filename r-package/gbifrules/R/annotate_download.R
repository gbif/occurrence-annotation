#' Annotate a GBIF download with annotation terms from rules
#'
#' @param d a GBIF download in DWCA format 
#' @param project_id optional project ID(s) to filter rules by specific project(s). Can be a single ID or vector of IDs.
#' @param use_higher_taxonomy logical; if TRUE, rules will match records based on higher taxonomic ranks. The function checks for matches against kingdomKey, phylumKey, classKey, orderKey, familyKey, genusKey, speciesKey, and taxonKey columns in the download data. For example, a rule created for taxonKey 212 (Aves/Birds) will match all bird species records that have classKey = 212. Default is FALSE for conservative, explicit annotations only.
#' @param include_vote_counts logical; if TRUE, add support_count and contest_count columns to the output showing the number of supports and contests for each annotation. For records with multiple annotations, shows the counts for the most-supported rule. Default is FALSE.
#' @param min_support integer; minimum number of supports required for a rule to be applied. NULL (default) means no minimum. Only rules with at least this many supports will be used.
#' @param exclude_contested logical; if TRUE, exclude any rules that have been contested (downvoted). Default is FALSE.
#'
#' @return The original download `data.frame()` with an added `annotations` column
#' @description
#' Adds an "annotations" column to the download containing annotation terms (SUSPICIOUS, NATIVE, INTRODUCED, etc.)
#' from matching rules. Multiple annotations for the same record are semicolon-delimited.
#' Records without any matching annotations will have NA in the annotations column.
#' If project_id is provided, only rules belonging to those project(s) will be used.
#' When use_higher_taxonomy is TRUE, rules can match records at any taxonomic level present in the download.
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
#' 
#' # Enable higher taxonomy matching
#' annotated <- annotate_download(d, use_higher_taxonomy = TRUE)
#' 
#' # Include vote counts for transparency
#' annotated <- annotate_download(d, include_vote_counts = TRUE)
#' 
#' # Only use well-supported, uncontested rules
#' annotated <- annotate_download(d, min_support = 3, exclude_contested = TRUE)
#' }
annotate_download <- function(d, project_id = NULL, use_higher_taxonomy = FALSE, include_vote_counts = FALSE, min_support = NULL, exclude_contested = FALSE) {
  
  # Add unique record_id to ALL original records (including those with NA coordinates)
  d_with_id <- d |>
    dplyr::mutate(
      # Create unique record_id including basisOfRecord if present to handle duplicates
      record_id = if ("basisOfRecord" %in% colnames(d)) {
        paste(taxonKey, decimalLatitude, decimalLongitude, 
              ifelse(is.na(basisOfRecord), "NA", basisOfRecord), 
              dplyr::row_number(), sep = "_")
      } else {
        paste(taxonKey, decimalLatitude, decimalLongitude, dplyr::row_number(), sep = "_")
      }
    )
  
  # Filter to records with valid coordinates for spatial processing
  d_with_coords <- d_with_id |>
    dplyr::filter(!is.na(decimalLongitude), !is.na(decimalLatitude)) |>
    dplyr::mutate(
      lon = decimalLongitude,
      lat = decimalLatitude
    )
  
  # Prepare simplified dataset for rule checking
  # Include basisOfRecord, datasetKey, and year if they exist in the data
  # Also include higher taxonomy columns if use_higher_taxonomy is enabled
  columns_to_select <- c(
    "decimalLongitude",
    "decimalLatitude",
    "taxonKey",
    "record_id",
    "lon",
    "lat"
  )
  
  # Add optional columns
  columns_to_select <- c(columns_to_select, "basisOfRecord", "datasetKey", "year")
  
  # Add higher taxonomy columns if enabled
  if (use_higher_taxonomy) {
    taxonomy_columns <- c("kingdomKey", "phylumKey", "classKey", "orderKey", 
                          "familyKey", "genusKey", "speciesKey")
    columns_to_select <- c(columns_to_select, taxonomy_columns)
  }
  
  d_clean <- d_with_coords |>
    dplyr::select(dplyr::any_of(columns_to_select)) |>
    unique()
  
  # Get all annotations for all taxon keys in the dataset
  all_annotations <- get_all_annotations(d_clean, project_id = project_id, use_higher_taxonomy = use_higher_taxonomy, include_vote_counts = include_vote_counts, min_support = min_support, exclude_contested = exclude_contested)
  
  # Merge annotations back with ALL original data (including records with NA coordinates)
  out <- d_with_id |>
    dplyr::left_join(all_annotations, by = "record_id") |>
    dplyr::select(-record_id)
  
  return(out)
}

get_all_annotations <- function(d, project_id = NULL, use_higher_taxonomy = FALSE, include_vote_counts = FALSE, min_support = NULL, exclude_contested = FALSE) {
  # Get unique taxon keys from the dataset
  unique_taxon_keys <- unique(d$taxonKey)
  
  # If use_higher_taxonomy is TRUE, expand to include all taxonomy keys
  if (use_higher_taxonomy) {
    # Extract all taxonomy keys from available columns
    taxonomy_columns <- c("kingdomKey", "phylumKey", "classKey", "orderKey", 
                          "familyKey", "genusKey", "speciesKey", "taxonKey")
    available_columns <- intersect(taxonomy_columns, colnames(d))
    
    # Collect all unique taxonomy keys from available columns
    all_taxonomy_keys <- unique(unlist(lapply(available_columns, function(col) {
      unique(d[[col]])
    })))
    
    # Remove NA values and use expanded set
    unique_taxon_keys <- unique(all_taxonomy_keys[!is.na(all_taxonomy_keys)])
  }
  
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
  
  # Filter rules by support/contest requirements
  n_rules_before_filter <- nrow(all_rules)
  
  if (nrow(all_rules) > 0) {
    # Calculate vote counts for each rule
    # supportedBy and contestedBy can be: NA, NULL, empty list, list with elements, or character vector
    all_rules <- all_rules |>
      dplyr::mutate(
        support_count = sapply(supportedBy, function(x) {
          if (is.null(x)) return(0L)
          if (length(x) == 1 && is.na(x)) return(0L)  # Handles NA (logical or character)
          if (is.list(x) && length(x) == 0) return(0L)
          if (is.character(x)) return(as.integer(length(x)))  # Character vector with usernames
          if (is.list(x)) return(as.integer(length(x)))  # List with usernames
          return(0L)
        }),
        contest_count = sapply(contestedBy, function(x) {
          if (is.null(x)) return(0L)
          if (length(x) == 1 && is.na(x)) return(0L)  # Handles NA (logical or character)
          if (is.list(x) && length(x) == 0) return(0L)
          if (is.character(x)) return(as.integer(length(x)))  # Character vector with usernames
          if (is.list(x)) return(as.integer(length(x)))  # List with usernames
          return(0L)
        })
      )
    
    # Apply minimum support filter
    if (!is.null(min_support)) {
      all_rules <- all_rules |>
        dplyr::filter(support_count >= min_support)
    }
    
    # Apply exclude contested filter
    if (exclude_contested) {
      all_rules <- all_rules |>
        dplyr::filter(contest_count == 0)
    }
  }
  
  # Warn if all rules were filtered out by vote requirements
  if (n_rules_before_filter > 0 && nrow(all_rules) == 0) {
    warning(sprintf("All %d rules were filtered out by vote requirements (min_support=%s, exclude_contested=%s)",
                    n_rules_before_filter,
                    ifelse(is.null(min_support), "NULL", as.character(min_support)),
                    exclude_contested))
  }
  
  if (nrow(all_rules) == 0) {
    # No rules found, return data with NA annotations
    result <- d |>
      dplyr::select(record_id) |>
      dplyr::mutate(annotations = NA_character_)
    
    if (include_vote_counts) {
      result <- result |>
        dplyr::mutate(
          support_count = NA_integer_,
          contest_count = NA_integer_
        )
    }
    
    return(result)
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
      
      # Try to parse the geometry, skip rule if it fails
      polygon <- tryCatch({
        suppressWarnings({
          rule |>
            dplyr::mutate(geometry = sf::st_as_sfc(geometry, crs = 4326)) |>
            sf::st_sf() |>
            sf::st_geometry() |>
            sf::st_make_valid() |>
            sf::st_transform(crs = 3857)  # Transform to same CRS as points
        })
      }, error = function(e) {
        # Silently skip rules with invalid geometries
        suppressMessages(sf::sf_use_s2(old_s2))  # Restore s2 setting
        return(NULL)
      })
      
      # If polygon parsing failed, skip this rule
      if (is.null(polygon)) {
        return(data.frame())
      }
      
      # Filter points to those matching this rule's taxonKey
      # When use_higher_taxonomy is TRUE, match against any taxonomy level
      if (use_higher_taxonomy) {
        # Build filter condition: rule's taxonKey matches any taxonomy column
        taxonomy_columns <- c("kingdomKey", "phylumKey", "classKey", "orderKey", 
                              "familyKey", "genusKey", "speciesKey", "taxonKey")
        available_columns <- intersect(taxonomy_columns, colnames(d))
        
        # Check if rule's taxonKey matches any of the available taxonomy columns
        matches <- rep(FALSE, nrow(d))
        for (col in available_columns) {
          matches <- matches | (!is.na(d[[col]]) & d[[col]] == rule$taxonKey)
        }
        d_sf_for_rule <- d_sf[matches, ]
      } else {
        # Exact match on taxonKey only
        d_sf_for_rule <- d_sf[d_sf$taxonKey == rule$taxonKey, ]
      }
      
      # Determine which points (for this taxon) are within the polygon
      within <- as.vector(sf::st_within(d_sf_for_rule, polygon, sparse = FALSE))
      
      # Restore s2 setting
      suppressMessages(sf::sf_use_s2(old_s2))
      
      # Apply basisOfRecord filtering if specified in the rule
      # Filter records matching this rule's taxonKey (considering higher taxonomy if enabled)
      if (use_higher_taxonomy) {
        taxonomy_columns <- c("kingdomKey", "phylumKey", "classKey", "orderKey", 
                              "familyKey", "genusKey", "speciesKey", "taxonKey")
        available_columns <- intersect(taxonomy_columns, colnames(d))
        
        matches <- rep(FALSE, nrow(d))
        for (col in available_columns) {
          matches <- matches | (!is.na(d[[col]]) & d[[col]] == rule$taxonKey)
        }
        records_for_rule <- d[matches, ] |>
          dplyr::mutate(
            is_matching_spatial = within,
            rule_id = rule$id,
            rule_annotation = rule$annotation
          )
      } else {
        records_for_rule <- d |>
          dplyr::filter(taxonKey == rule$taxonKey) |>
          dplyr::mutate(
            is_matching_spatial = within,
            rule_id = rule$id,
            rule_annotation = rule$annotation
          )
      }
      
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
      
      # Apply yearRange filter if specified in the rule AND the data has year column
      has_year_filter <- !is.null(rule$yearRange) && 
                         !is.na(rule$yearRange) && 
                         nchar(rule$yearRange) > 0 && 
                         "year" %in% colnames(records_for_rule)
      
      if (has_year_filter) {
        year_range_str <- rule$yearRange
        
        # Parse yearRange format: start,end or *,end or start,*
        # Backend API format: "1900,2000", "*,1950", "1950,*"
        min_year <- -Inf
        max_year <- Inf
        
        if (grepl(",", year_range_str)) {
          # Format: start,end or *,end or start,*
          parts <- strsplit(year_range_str, ",")[[1]]
          if (parts[1] != "*" && nchar(trimws(parts[1])) > 0) {
            min_year <- as.integer(trimws(parts[1]))
          }
          if (parts[2] != "*" && nchar(trimws(parts[2])) > 0) {
            max_year <- as.integer(trimws(parts[2]))
          }
        } else {
          # Format: single year (exact match)
          single_year <- as.integer(year_range_str)
          min_year <- single_year
          max_year <- single_year
        }
        
        # Filter: rule applies only to records within the year range
        records_for_rule <- records_for_rule |>
          dplyr::mutate(
            is_matching_year = !is.na(year) & (year >= min_year) & (year <= max_year),
            # Combine with existing is_matching (from spatial + basisOfRecord + datasetKey)
            is_matching = is_matching & is_matching_year
          )
      }
      
      # Return results for this rule - only matching records with their annotation and vote counts
      result_data <- records_for_rule |>
        dplyr::filter(is_matching) |>
        dplyr::select(record_id, rule_annotation)
      
      # Add vote counts if requested
      if (include_vote_counts && nrow(result_data) > 0) {
        result_data <- result_data |>
          dplyr::mutate(
            rule_support_count = rule$support_count,
            rule_contest_count = rule$contest_count
          )
      }
      
      result_data
    })
  
  # Combine results and create semicolon-delimited annotation strings
  if (nrow(annotation_results) == 0) {
    # No annotations found
    summary_results <- d |>
      dplyr::select(record_id) |>
      dplyr::mutate(annotations = NA_character_)
    
    if (include_vote_counts) {
      summary_results <- summary_results |>
        dplyr::mutate(
          support_count = NA_integer_,
          contest_count = NA_integer_
        )
    }
  } else {
    # Group by record_id and combine annotations with semicolons
    if (include_vote_counts) {
      # Include vote counts - show counts for most-supported rule
      # First, sort by support_count descending within each record
      summary_results <- annotation_results |>
        dplyr::arrange(record_id, dplyr::desc(rule_support_count)) |>
        dplyr::group_by(record_id) |>
        dplyr::summarise(
          annotations = paste(unique(rule_annotation), collapse = ";"),
          support_count = dplyr::first(rule_support_count),
          contest_count = dplyr::first(rule_contest_count),
          .groups = "drop"
        ) |>
        dplyr::right_join(
          d |> dplyr::select(record_id),
          by = "record_id"
        )
    } else {
      # No vote counts requested
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
  }
  
  return(summary_results)
}
