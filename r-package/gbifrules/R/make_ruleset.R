#' Make Ruleset
#'
#' @param projectId the id of the project the ruleset should belong to.  
#' @param name the name of the project. 
#' @param description describe the project. 
#'
#' @return
#' The rulesetId and projectId of the ruleset as a list.
#' 
#' @export
#'
#' @examples
#' \dontrun{
#' make_ruleset(1,"Name of project","Example description")
#' }
make_ruleset = function(projectId = NULL, name = NULL, description = NULL) {
  
  if(is.null(name)) stop("Please provide a name for the ruleset.")
  if(is.null(description)) stop("Please provide a description for the ruleset.")
  
  url <- gbifrules_url("ruleset")
  
  body <- gbifrules_body(
    projectId = projectId,
    name=name,
    description=description) 
  
  gbifrules_post(url,body)
}
