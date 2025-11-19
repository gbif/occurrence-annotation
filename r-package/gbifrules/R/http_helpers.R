#' gbifrules_post
#' @param url helper
#' @param body helper
#' @keywords internal
gbifrules_post <- function(url,body) {
  httr2::request(url) |>
    httr2::req_method("POST") |>
    httr2::req_auth_basic(Sys.getenv("GBIF_USER", ""),
                          Sys.getenv("GBIF_PWD", "")) |>
    httr2::req_body_json(body) |>
    httr2::req_perform() |>
    httr2::resp_body_json() 
}

#' gbifrules_delete
#' @param url helper
#' @keywords internal
gbifrules_delete <- function(url) {
 httr2::request(url) |>
  httr2::req_method("DELETE") |>
  httr2::req_auth_basic(Sys.getenv("GBIF_USER", ""),
                        Sys.getenv("GBIF_PWD", "")) |>
  httr2::req_perform() |>
  httr2::resp_body_json() 
}

#' gbifrules_get
#' @param url helper
#' @param query helper 
#' @keywords internal
gbifrules_get <- function(url,query) {  

httr2::request(url) |>
  httr2::req_url_query(!!!query) |>
  httr2::req_perform() |>
  httr2::resp_body_json() |> 
  purrr::map(~
   .x |>             
   tibble::enframe() |> 
   tidyr::pivot_wider(names_from="name",values_from="value")
   ) |>
   dplyr::bind_rows()   
}

#' gbifrules_put
#' @param url helper
#' @param body helper 
#' @keywords internal
gbifrules_put <- function(url,body) {
  httr2::request(url) |>
    httr2::req_method("PUT") |>
    httr2::req_auth_basic(Sys.getenv("GBIF_USER", ""),
                          Sys.getenv("GBIF_PWD", "")) |>
    httr2::req_body_json(body) |>
    httr2::req_perform() |>
    httr2::resp_body_json()
}

#' gbifrules_get_
#' @param url helper
#' @param query helper
#' @keywords internal
gbifrules_get_ <- function(url,query) {  
  
  httr2::request(url) |>
    httr2::req_url_query(!!!query) |>
    httr2::req_perform() |>
    httr2::resp_body_json() 
}

#' gbifrules_get_id
#' @param url helper
#' @keywords internal
gbifrules_get_id <- function(url) {  
  
  httr2::request(url) |>
    httr2::req_perform() |>
    httr2::resp_body_json() |>
    tibble::enframe() |>
    tidyr::pivot_wider(names_from="name",values_from = "value") 
}

#' gbifrules_get_id_
#' @param url helper
#' @keywords internal
gbifrules_get_id_ <- function(url) {  
  
  httr2::request(url) |>
    httr2::req_perform() |>
    httr2::resp_body_json()
  
}

#' gbif_base
#' @keywords internal
gbif_base <- function() {
  # override with environmental variable for local development 
  # For development use Sys.setenv(GBIFRULES_URL = "http://localhost:8080/occurrence/experimental/annotation/")
  if(Sys.getenv("GBIFRULES_URL") == "") {
    url <- "https://api.gbif.org/v1/occurrence/experimental/annotation/"
  } else {
    url <- Sys.getenv("GBIFRULES_URL")
  }
  # if we are running on github actions use the localhost 
  if(Sys.getenv("GBIFRULES_GITHUB_ACTIONS") == "true") {
    url <- "http://localhost:8080/occurrence/experimental/annotation/"
  }
  
  url
}

#' gbifrules_body
#' @param ... helper
#' @keywords internal
gbifrules_body <- function(...) list(...) |> purrr::compact() |> purrr::flatten()

#' gbifrules_url 
#' @param x helper
#' @keywords internal
gbifrules_url <- function(x) paste0(gbif_base(),x)
