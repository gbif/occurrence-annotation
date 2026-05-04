#' Remove contest of a rule
#'
#' @param id id of rule to contest.
#' @param user (character) Optional username for authentication. Defaults to GBIF_USER environment variable.
#' @param pwd (character) Optional password for authentication. Defaults to GBIF_PWD environment variable. 
#'
#' @return A `list` information about the rule contested. 
#' @export
#'
#' @examples
#' \dontrun{
#' rm_contest_rule(1)
#' }
rm_contest_rule <- function(id, user = NULL, pwd = NULL) {
  url <- paste0(gbifrules_url("rule/"), id, "/removeContest")
  gbifrules_post(url, body = NULL, user, pwd)
}
