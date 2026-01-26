#' Delete a rule comment
#'
#' @param ruleId The ID of the rule that the comment belongs to
#' @param commentId The ID of the comment to delete
#'
#' @return Nothing (invisible NULL)
#' @export
#'
#' @examples 
#' \dontrun{
#' delete_rule_comment(ruleId = 1, commentId = 5)
#' }
delete_rule_comment <- function(ruleId, commentId) {
  url <- paste0(gbifrules_url("rule/"), ruleId, "/comment/", commentId)
  gbifrules_delete(url)
  invisible(NULL)
}
