#' Get rules
#'
#' @param id rule id.
#' @param limit page start.
#' @param offset number of records to return on page. 
#' @param ... Additional args passed to query. 
#'
#' @return a tibble of rules 
#' @export
#'
#' @examples 
#' \dontrun{
#' get_rule()
#' }
get_rule <- function(id=NULL,limit=NULL,offset=NULL,...) {
  
  if(is.null(id)) {
    url <- gbifrules_url("rule")
    query <- list(...,limit=limit,offset=offset) |>
      purrr::compact()
    r <- gbifrules_get(url,query)
  } else {
    url <- paste0(gbifrules_url("rule/"),id)
    r <- gbifrules_get_id(url) 
  }
  if(length(r) == 0) {
    tibble::tibble()
  } else {
    r |> 
    tidyr::unnest(cols = c("id", 
                           "taxonKey", 
                           "datasetKey", 
                           "geometry", 
                           "annotation", 
                           "rulesetId", 
                           "projectId",
                           "created", 
                           "createdBy", 
                           "deleted", 
                           "deletedBy"))
  }
  
}
