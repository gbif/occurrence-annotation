#' Add a new member to a ruleset
#'
#' @param id the ruleset id. 
#' @param new_member the GBIF user to be added. 
#'
#' @return A `list` of ruleset information. 
#' @export
#'
#' @examples
#' \dontrun{
#' add_ruleset_member(1,"JOHN")
#' }
add_ruleset_member <- function(id=NULL,new_member=NULL) {
  
  members <- get_ruleset(id)$members 
  members <- c(unlist(members),new_member)
  
  update_ruleset(id,members=members)
}
