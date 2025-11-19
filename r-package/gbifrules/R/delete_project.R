#' Delete a project
#'
#' @param id the id of the project
#'
#' @return list of information about deleted project
#' @export
#'
#' @examples
#' \dontrun{
#' delete_project(1)
#' }
delete_project <- function(id) {
url <- paste0(gbifrules_url("project/"),id)
gbifrules_delete(url)  
}
