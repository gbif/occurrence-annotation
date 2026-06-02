#' Delete a ruleset
#'
#' @param id the id of the ruleset
#' @param user (character) Optional username for authentication. Defaults to GBIF_USER environment variable.
#' @param pwd (character) Optional password for authentication. Defaults to GBIF_PWD environment variable.
#'
#' @return list of information about deleted ruleset
#' @export
#'
#' @examples
#' \dontrun{
#' delete_ruleset(1)
#' }
delete_ruleset = function(id, user = NULL, pwd = NULL) {
  url <- paste0(gbifrules_url("ruleset/"), id)
  gbifrules_delete(url, user, pwd)  
}
