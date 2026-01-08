#' Delete a rule
#'
#' @param id the id of the rule
#'
#' @return list of information about deleted rule.
#' @export
#'
#' @examples
#' \dontrun{
#' delete_rule(1)
#' }
delete_rule <- function(id) {
  url <- paste0(gbifrules_url("rule/"),id)
  gbifrules_delete(url)  
}
