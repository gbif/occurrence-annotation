#' Update a ruleset 
#'
#' @param id of ruleset. 
#' @param name new name of ruleset. 
#' @param projectId id of project ruleset belongs. 
#' @param description new description of ruleset. 
#' @param members new members of ruleset. If `keep_members=TRUE`, then new will be added to old members.
#' @param deleted logical should the ruleset be deleted or restored. 
#' @param createdBy new creator of ruleset. 
#' @param keep_members keep old members. Default is TRUE.
#' @param user (character) Optional username for authentication. Defaults to GBIF_USER environment variable.
#' @param pwd (character) Optional password for authentication. Defaults to GBIF_PWD environment variable.
#'
#' @return A `list` of an updated ruleset. 
#'
#' @export
#'
#' @examples
#' \dontrun{
#' update_ruleset(1,1,name="new name")
#' }
update_ruleset <- function(id=NULL,
                           projectId=NULL,
                           name=NULL,
                           description=NULL,
                           members=NULL,
                           deleted=NULL,
                           createdBy=NULL,
                           keep_members=TRUE,
                           user = NULL,
                           pwd = NULL
) {
  
  if(is.null(id)) stop("Must supply a project id.")
  ruleset <- gbifrules_get_id_(paste0(gbifrules_url("ruleset/"),id), user, pwd)
  
  if(keep_members) members <- c(unlist(ruleset$members),members) |> unique()
  
  if(!is.null(projectId)) ruleset$projectId <- projectId
  if(!is.null(name)) ruleset$name <- name
  if(!is.null(description)) ruleset$description <- description
  if(!is.null(members)) ruleset$members <- as.list(members)
  if(!is.null(deleted)) ruleset$deleted <- deleted
  if(!is.null(createdBy)) ruleset$createdBy <- createdBy
  
  body <- ruleset
  url <- paste0(gbifrules_url("ruleset/"),id)
  
  gbifrules_put(url, body, user, pwd)
}
