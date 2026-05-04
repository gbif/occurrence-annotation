#' Delete a rule
#'
#' @param id the id of the rule
#' @param user (character) Optional username for authentication. Defaults to GBIF_USER environment variable.
#' @param pwd (character) Optional password for authentication. Defaults to GBIF_PWD environment variable.
#'
#' @return list of information about deleted rule.
#' @export
#'
#' @examples
#' \dontrun{
#' delete_rule(1)
#' }
delete_rule <- function(id, user = NULL, pwd = NULL) {
  url <- paste0(gbifrules_url("rule/"), id)
  gbifrules_delete(url, user, pwd)  
}
