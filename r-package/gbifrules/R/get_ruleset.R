#' Get a ruleset. 
#'
#' @param id the id of the ruleset. 
#' @param projectId id of project. 
#' @param limit page start.
#' @param offset number of records to return on page. 
#'
#' @return a `tibble`. 
#' @export
#'
#' @examples
#' \dontrun{
#' get_ruleset(1,1)
#' }
get_ruleset <- function(id=NULL,projectId=NULL,limit=NULL,offset=NULL) {
  if(is.null(id)) { 
    url <- gbifrules_url("ruleset")
    query <- list(id=id,
                  projectId=projectId,
                  offset=offset,
                  limit=limit
    ) |> 
      purrr::compact()
    r <- gbifrules_get(url,query=query)
  } else {
    url <- paste0(gbifrules_url("ruleset/"),id)
    r <- gbifrules_get_id(url)
  }
  if(length(r) == 0) {
    # return empty tibble if nothing  
    tibble::tibble()
  } else {
  r |>
    tidyr::unnest(cols = c("id",
                           "name",
                           "description",
                           "projectId",
                           "created",
                           "createdBy",
                           "modified",
                           "modifiedBy",
                           "deleted",
                           "deletedBy"))
  }
}
