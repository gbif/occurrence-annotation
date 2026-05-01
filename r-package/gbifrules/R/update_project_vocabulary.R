#' Update project vocabulary
#'
#' Set or update custom annotation vocabulary for a project. Must be a project member
#' to update vocabulary.
#'
#' @param id the project id (required).
#' @param vocabulary a list or data frame of vocabulary terms. Each term must have:
#'   \itemize{
#'     \item term: The vocabulary term (will be converted to uppercase)
#'     \item description: Optional description of the term
#'     \item color: Hex color code for the term (e.g., "#ef4444")
#'     \item locked: Logical indicating if term can be deleted (SUSPICIOUS must be locked)
#'   }
#'
#' @return a `list` with the updated vocabulary.
#' 
#' @details
#' Update or replace the custom vocabulary for a project. The vocabulary must include
#' the "SUSPICIOUS" term with locked=TRUE. Maximum 50 terms allowed. Terms are automatically
#' normalized to uppercase.
#' 
#' Only project members can update vocabulary. Authentication via GBIF_USER and GBIF_PWD
#' environment variables is required.
#' 
#' @export  
#'
#' @examples
#' \dontrun{
#' # Create custom vocabulary
#' vocab <- list(
#'   list(term = "NATIVE", description = "Native species", 
#'        color = "#22c55e", locked = FALSE),
#'   list(term = "INTRODUCED", description = "Introduced species", 
#'        color = "#3b82f6", locked = FALSE),
#'   list(term = "SUSPICIOUS", description = "Suspicious record", 
#'        color = "#ef4444", locked = TRUE)
#' )
#' 
#' update_project_vocabulary(1, vocab)
#' }
update_project_vocabulary <- function(id, vocabulary) {
  
  if(is.null(id)) stop("Must supply a project id.")
  if(is.null(vocabulary)) stop("Must supply vocabulary terms.")
  
  # Convert data frame to list of lists if needed
  if(is.data.frame(vocabulary)) {
    vocabulary <- vocabulary |>
      dplyr::mutate(dplyr::across(dplyr::where(is.character), ~ dplyr::na_if(.x, ""))) |>
      purrr::transpose()
  }
  
  # Ensure each term has required fields
  vocabulary <- purrr::map(vocabulary, function(term) {
    if(is.null(term$term)) stop("Each vocabulary term must have a 'term' field")
    if(is.null(term$color)) stop("Each vocabulary term must have a 'color' field")
    if(is.null(term$locked)) term$locked <- FALSE
    
    # Remove NULL description to avoid sending it to API
    if(is.null(term$description) || is.na(term$description)) {
      term$description <- NULL
    }
    
    term
  })
  
  body <- vocabulary
  url <- paste0(gbifrules_url("project/"), id, "/vocabulary")
  
  gbifrules_put(url, body)
}
