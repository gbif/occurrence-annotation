#' Get COL dataset DOI from GBIF API (internal utility)
#' 
#' Fetches the DOI for a GBIF dataset. Used internally by make_rule() to auto-populate
#' the checklistDoi field when using COL defaults. Results are session-cached.
#' 
#' @param datasetKey Character; GBIF dataset UUID (defaults to COL XR UUID)
#' @return Character DOI or NULL on error
#' @keywords internal
#' @noRd
get_col_metadata <- function(datasetKey = "7ddf754f-d193-4cc9-b351-99906754a03b") {
  
  # Check if we have a cached DOI for this datasetKey
  cache_key <- paste0("doi_", datasetKey)
  if (!is.null(.gbifrules_cache[[cache_key]])) {
    return(.gbifrules_cache[[cache_key]])
  }
  
  # Fetch dataset metadata from GBIF API
  url <- paste0("https://api.gbif.org/v1/dataset/", datasetKey)
  
  doi <- tryCatch({
    resp <- httr2::request(url) |>
      httr2::req_error(is_error = \(resp) FALSE) |>  # Don't auto-error on HTTP errors
      httr2::req_perform()
    
    # Check if request was successful
    if (httr2::resp_status(resp) != 200) {
      warning("Failed to fetch dataset metadata from GBIF API (HTTP ", 
              httr2::resp_status(resp), "). Proceeding without DOI.")
      return(NULL)
    }
    
    # Parse JSON response and extract DOI
    body <- httr2::resp_body_json(resp)
    
    if (is.null(body$doi)) {
      warning("Dataset metadata does not contain a DOI field. Proceeding without DOI.")
      return(NULL)
    }
    
    # Return DOI string
    body$doi
    
  }, error = function(e) {
    # Gracefully handle any errors (network issues, JSON parsing, etc.)
    warning("Error fetching dataset metadata: ", e$message, ". Proceeding without DOI.")
    return(NULL)
  })
  
  # Cache the result (even if NULL) to avoid repeated failed requests
  .gbifrules_cache[[cache_key]] <- doi
  
  return(doi)
}

# Package environment for caching dataset metadata
.gbifrules_cache <- new.env(parent = emptyenv())
