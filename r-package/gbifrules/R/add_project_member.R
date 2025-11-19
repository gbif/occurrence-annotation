#' Add a new member to a project
#'
#' @param id the project id. 
#' @param new_member the GBIF user to be added. 
#'
#' @return A `list` of project information. 
#' @export
#'
#' @examples
#' \dontrun{
#' add_project_member(1,"JOHN")
#' }
add_project_member <- function(id=NULL,new_member=NULL) {
  
  members <- get_project(id)$members 
  members <- c(unlist(members),new_member)
  
  update_project(id,members=members)
}
