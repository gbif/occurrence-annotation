#' Get a project
#'
#' @param id the id of the project.
#' @param offset page start.
#' @param limit number of records to return on page. 
#'
#' @return a `tibble`. 
#' @export
#'
#' @examples
#' \dontrun{
#' get_project()
#' }
get_project <- function(id=NULL,offset=NULL,limit=NULL) {
  
  if(is.null(id)) { 
    url <- gbifan_url("project")
    query <- list(id=id,
                  offset=offset,
                  limit=limit
    ) |> 
      purrr::compact()
    r <- gbifan_get(url,query=query)
  } else {
    if(!is.null(offset)) warning("offset ignored when id is not null")
    if(!is.null(limit)) warning("limit ignored when id is not null")
    url <- paste0(gbifan_url("project/"),id)
    r <- gbifan_get_id(url)
  }
  r |> 
    tidyr::unnest(cols = c("id", 
                           "name", 
                           "description",
                           "created", 
                           "createdBy",
                           "modified",
                           "modifiedBy",
                           "deleted", 
                           "deletedBy"))
  
}