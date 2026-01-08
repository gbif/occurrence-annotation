#' Update a project 
#'
#' @param id project id. 
#' @param name new name of project. 
#' @param description new description for project. 
#' @param members new members. If `keep_members=TRUE`, then new will be added to old members. 
#' @param deleted logical should the project be deleted or restored. 
#' @param createdBy new creator of project. 
#' @param keep_members keep old members. Default is TRUE.  
#'
#' @return A `list` with data of the new project. 
#' 
#' @details
#' Update a project. If fields are left `NULL`, then they will not be updated. 
#' If `keep_memebers=TRUE`, new members are added to the list of old members. 
#' 
#' @export  
#'
#' @examples
#' \dontrun{
#' update_project(1,name="New name")
#' }
update_project <- function(id=NULL,
                          name=NULL,
                          description=NULL,
                          members=NULL,
                          deleted=NULL,
                          createdBy=NULL,
                          keep_members=TRUE
                          ) {
  
  if(is.null(id)) stop("Must supply a project id.")
  project <- gbifrules_get_id_(paste0(gbifrules_url("project/"),id))
  
  if(keep_members) members <- c(unlist(project$members),members) |> unique()
  
  if(!is.null(name)) project$name = name
  if(!is.null(description)) project$description = description
  if(!is.null(members)) project$members = as.list(members)
  if(!is.null(deleted)) project$deleted = deleted
  if(!is.null(createdBy)) project$createdBy = createdBy
  
  body <- project
  url <- paste0(gbifrules_url("project/"),id)
  
  gbifrules_put(url,body)
}
