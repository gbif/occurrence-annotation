#' Delete a rule comment
#'
#' @param ruleId The ID of the rule that the comment belongs to
#' @param commentId The ID of the comment to delete
#' @param user (character) Optional username for authentication. Defaults to GBIF_USER environment variable.
#' @param pwd (character) Optional password for authentication. Defaults to GBIF_PWD environment variable.
#'
#' @return Nothing (invisible NULL)
#' @export
#'
#' @examples 
#' \dontrun{
#' delete_rule_comment(ruleId = 1, commentId = 5)
#' }
delete_rule_comment <- function(ruleId, commentId, user = NULL, pwd = NULL) {
  url <- paste0(gbifrules_url("rule/"), ruleId, "/comment/", commentId)
  gbifrules_delete(url, user, pwd)
  invisible(NULL)
}
