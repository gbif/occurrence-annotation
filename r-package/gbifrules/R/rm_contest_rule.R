#' Remove contest of a rule
#'
#' @param id id of rule to contest. 
#'
#' @return A `list` information about the rule contested. 
#' @export
#'
#' @examples
#' \dontrun{
#' rm_contest_rule(1)
#' }
rm_contest_rule <- function(id) {
  url <- paste0(gbifrules_url("rule/"),id,"/removeContest")
  gbifrules_post(url,body=NULL)
}
