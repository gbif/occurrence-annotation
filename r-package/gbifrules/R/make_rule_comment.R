#' Make a comment on rule. 
#'
#' @param id id of the rule you want to leave a comment on. 
#' @param comment comment.
#' @param user (character) Optional username for authentication. Defaults to GBIF_USER environment variable.
#' @param pwd (character) Optional password for authentication. Defaults to GBIF_PWD environment variable. 
#'
#' @return A `tibble`. 
#' @export
#'
#' @examples
#' \dontrun{
#' make_rule_comment(1,"comment")
#' }
make_rule_comment = function(id = NULL, comment = NULL, user = NULL, pwd = NULL) {
  url <- paste0(gbifrules_url("rule/"), id, "/comment")
  body <- gbifrules_body(comment=comment)
  gbifrules_post(url, body, user, pwd) 
}
