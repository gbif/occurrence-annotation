#' gbifan_post
#' @param url helper
#' @param body helper
#' @keywords internal
gbifan_post <- function(url,body) {
  httr2::request(url) |>
    httr2::req_method("POST") |>
    httr2::req_auth_basic(Sys.getenv("GBIF_USER", ""),
                          Sys.getenv("GBIF_PWD", "")) |>
    httr2::req_body_json(body) |>
    httr2::req_perform() |>
    httr2::resp_body_json() 
}

#' gbifan_delete
#' @param url helper
#' @keywords internal
gbifan_delete <- function(url) {
 httr2::request(url) |>
  httr2::req_method("DELETE") |>
  httr2::req_auth_basic(Sys.getenv("GBIF_USER", ""),
                        Sys.getenv("GBIF_PWD", "")) |>
  httr2::req_perform() |>
  httr2::resp_body_json() 
}

#' gbifan_get
#' @param url helper
#' @param query helper 
#' @keywords internal
gbifan_get <- function(url,query) {  

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

#' gbifan_put
#' @param url helper
#' @param body helper 
#' @keywords internal
gbifan_put <- function(url,body) {
  httr2::request(url) |>
    httr2::req_method("PUT") |>
    httr2::req_auth_basic(Sys.getenv("GBIF_USER", ""),
                          Sys.getenv("GBIF_PWD", "")) |>
    httr2::req_body_json(body) |>
    httr2::req_perform() |>
    httr2::resp_body_json()
}

#' gbifan_get_
#' @param url helper
#' @param query helper
#' @keywords internal
gbifan_get_ <- function(url,query) {  
  
  httr2::request(url) |>
    httr2::req_url_query(!!!query) |>
    httr2::req_perform() |>
    httr2::resp_body_json() 
}

#' gbifan_get_id
#' @param url helper
#' @keywords internal
gbifan_get_id <- function(url) {  
  
  httr2::request(url) |>
    httr2::req_perform() |>
    httr2::resp_body_json() |>
    tibble::enframe() |>
    tidyr::pivot_wider(names_from="name",values_from = "value") 
}

#' gbifan_get_id_
#' @param url helper
#' @keywords internal
gbifan_get_id_ <- function(url) {  
  
  httr2::request(url) |>
    httr2::req_perform() |>
    httr2::resp_body_json()
  
}

#' gbif_base
#' @keywords internal
gbif_base <- function() {
  # overide with environmental variable for local development 
  if(Sys.getenv("GBIFAN_URL") == "") {
    url <- "https://api.gbif.org/v1/occurrence/experimental/annotation/"
  } else {
    url <- Sys.getenv("GBIFAN_URL")
  }
  # if we are running on github actions use the localhost 
  if(Sys.getenv("GBIFAN_GITHUB_ACTIONS") == "true") {
    url <- "http://localhost:8080/occurrence/experimental/annotation/"
  }
  
  url
}

#' gbifan_body
#' @param ... helper
#' @keywords internal
gbifan_body <- function(...) list(...) |> purrr::compact() |> purrr::flatten()

#' gbifan_url 
#' @param x helper
#' @keywords internal
gbifan_url <- function(x) paste0(gbif_base(),x)
