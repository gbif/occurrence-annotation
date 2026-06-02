#' Delete a project
#'
#' @param id the id of the project
#' @param user (character) Optional username for authentication. Defaults to GBIF_USER environment variable.
#' @param pwd (character) Optional password for authentication. Defaults to GBIF_PWD environment variable.
#'
#' @return list of information about deleted project
#' @export
#'
#' @examples
#' \dontrun{
#' delete_project(1)
#' }
delete_project <- function(id, user = NULL, pwd = NULL) {
  url <- paste0(gbifrules_url("project/"), id)
  gbifrules_delete(url, user, pwd)  
}
