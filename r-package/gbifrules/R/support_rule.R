#' Support a rule
#'
#' @param id the id of the rule to updated.
#' @param user (character) Optional username for authentication. Defaults to GBIF_USER environment variable.
#' @param pwd (character) Optional password for authentication. Defaults to GBIF_PWD environment variable.
#'
#' @return A `list` information about the rule supported. 
#' @export
#'
#' @examples
#' \dontrun{
#' support_rule(1)
#' }
support_rule <- function(id = NULL, user = NULL, pwd = NULL) {
  url <- paste0(gbifrules_url("rule/"), id, "/support")
  gbifrules_post(url, body = NULL, user, pwd)
}
