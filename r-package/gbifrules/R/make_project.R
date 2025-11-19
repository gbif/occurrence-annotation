#' Make Project
#'
#' @param name the name of the project. 
#' @param description describe the project. 
#'
#' @return
#' The projectId of the project. 
#' 
#' @export
#'
#' @examples
#' \dontrun{
#' make_project("Example project","An example Project")
#' }
make_project = function(name = NULL, description = NULL) {
  url <- gbifrules_url("project") 
  
  if(is.null(name)) stop("Please provide a name for the project.")
  if(is.null(description)) stop("Please provide a description for the project.")
  
  body <- gbifrules_body(
    name=name,
    description=description)
  
  gbifrules_post(url,body)
  
}
