#' Remove support for a rule
#'
#' @param id the id of the rule to updated.
#'
#' @return A `list` information about the rule supported. 
#' @export
#'
#' @examples
#' \dontrun{
#' rm_support_rule(1)
#' }
rm_support_rule <- function(id=NULL) {
  url <- paste0(gbifan_url("rule/"),id,"/removeSupport")
  gbifan_post(url,body=NULL)
}
