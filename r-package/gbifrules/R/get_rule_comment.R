#' Get comments on rule
#'
#' @param id the id of the rule 
#'
#' @return a `tibble` of comments. 
#' @export
#'
#' @examples
#' \dontrun{
#' get_rule_comment(1)
#' }
get_rule_comment <- function(id=NULL) {
  if(is.null(id)) stop("must supply a rule id.")
  url <- paste0(gbifrules_url("rule/"),id,"/comment")
  
  c <- gbifrules_get_id_(url) 
  
  if(length(c) == 0) {
    tibble::tibble() 
  } else {
    c |>   
      purrr::map(~
                   .x |>             
                   tibble::enframe() |> 
                   tidyr::pivot_wider(names_from="name",values_from="value")
      ) |>
      dplyr::bind_rows() |>
      tidyr::unnest(cols=c("id",
                           "ruleId",
                           "comment",
                           "created",
                           "createdBy",
                           "deleted",
                           "deletedBy"))
  }
}
