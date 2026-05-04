#' Get project vocabulary
#'
#' Get the custom vocabulary for a project, or the default system vocabulary if
#' no custom vocabulary is defined.
#'
#' @param id the project id (required).
#'
#' @return a `tibble` with vocabulary terms containing columns: term, description, color, locked.
#' @export
#'
#' @details
#' Returns the annotation vocabulary for a project. If the project has a custom vocabulary
#' defined, it will be returned. Otherwise, returns the default system vocabulary which includes
#' NATIVE, INTRODUCED, MANAGED, FORMER, VAGRANT, SUSPICIOUS, and OTHER.
#'
#' @examples
#' \dontrun{
#' get_project_vocabulary(1)
#' }
get_project_vocab <- function(id) {
  
  if(is.null(id)) stop("Must supply a project id.")
  
  url <- paste0(gbifrules_url("project/"), id, "/vocabulary")
  r <- gbifrules_get_id_(url)
  
  # Check if result is empty or NULL
  if (is.null(r) || length(r) == 0) {
    # Return empty tibble with expected columns
    return(tibble::tibble(
      term = character(),
      description = character(),
      color = character(),
      locked = logical()
    ))
  }
  
  # Convert list to tibble
  r |>
    purrr::map(~
      .x |>             
      tibble::enframe() |> 
      tidyr::pivot_wider(names_from = "name", values_from = "value")
    ) |>
    dplyr::bind_rows() |>
    # Flatten list columns to character/logical
    dplyr::mutate(
      term = as.character(.data$term),
      description = as.character(.data$description),
      color = as.character(.data$color),
      locked = as.logical(.data$locked)
    )
}
