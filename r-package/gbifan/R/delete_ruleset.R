#' Delete a ruleset
#'
#' @param id the id of the ruleset
#'
#' @return list of information about deleted ruleset
#' @export
#'
#' @examples
#' \dontrun{
#' delete_ruleset(1)
#' }
delete_ruleset = function(id) {
  url <- paste0(gbifan_url("ruleset/"),id)
  gbifan_delete(url)  
}
