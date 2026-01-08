#' Support a rule
#'
#' @param id the id of the rule to updated.
#'
#' @return A `list` information about the rule supported. 
#' @export
#'
#' @examples
#' \dontrun{
#' support_rule(1)
#' }
support_rule <- function(id=NULL) {
  url <- paste0(gbifrules_url("rule/"),id,"/support")
  gbifrules_post(url,body=NULL)
}
