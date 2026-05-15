#' Delete project vocabulary
#'
#' Reset a project's vocabulary to the default system vocabulary. Removes any custom
#' vocabulary terms that were defined for the project.
#'
#' @param id the project id (required).
#' @param user (character) Optional username for authentication. Defaults to GBIF_USER environment variable.
#' @param pwd (character) Optional password for authentication. Defaults to GBIF_PWD environment variable.
#'
#' @return a `list` with the default vocabulary terms.
#' 
#' @details
#' Removes the custom vocabulary from a project and reverts to the default system vocabulary.
#' Only project members can reset vocabulary. Authentication via GBIF_USER and GBIF_PWD
#' environment variables is required (or can be provided via user/pwd parameters).
#' 
#' The default vocabulary includes: NATIVE, INTRODUCED, MANAGED, FORMER, VAGRANT, SUSPICIOUS, and OTHER.
#' 
#' @export  
#'
#' @examples
#' \dontrun{
#' # Reset project 1 to default vocabulary
#' delete_project_vocab(1)
#' }
delete_project_vocab <- function(id, user = NULL, pwd = NULL) {
  
  if(is.null(id)) stop("Must supply a project id.")
  
  url <- paste0(gbifrules_url("project/"), id, "/vocabulary")
  
  gbifrules_delete(url, user, pwd)
}
