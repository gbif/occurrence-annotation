#' gbifrules_post
#' @param url helper
#' @param body helper
#' @param user optional user for authentication, defaults to GBIF_USER env variable
#' @param pwd optional password for authentication, defaults to GBIF_PWD env variable
#' @keywords internal
gbifrules_post <- function(url, body, user = NULL, pwd = NULL) {
  # Use provided credentials or fall back to environment variables
  auth_user <- if(is.null(user)) Sys.getenv("GBIF_USER", "") else user
  auth_pwd <- if(is.null(pwd)) Sys.getenv("GBIF_PWD", "") else pwd
  
  httr2::request(url) |>
    httr2::req_method("POST") |>
    httr2::req_auth_basic(auth_user, auth_pwd) |>
    httr2::req_body_json(body) |>
    httr2::req_options(http_version = 1.1) |>  # Force HTTP/1.1
    httr2::req_perform() |>
    httr2::resp_body_json()
}

#' gbifrules_delete
#' @param url helper
#' @param user optional user for authentication, defaults to GBIF_USER env variable
#' @param pwd optional password for authentication, defaults to GBIF_PWD env variable
#' @keywords internal
gbifrules_delete <- function(url, user = NULL, pwd = NULL) {
  # Use provided credentials or fall back to environment variables
  auth_user <- if(is.null(user)) Sys.getenv("GBIF_USER", "") else user
  auth_pwd <- if(is.null(pwd)) Sys.getenv("GBIF_PWD", "") else pwd
  
  resp <- httr2::request(url) |>
    httr2::req_method("DELETE") |>
    httr2::req_auth_basic(auth_user, auth_pwd) |>
    httr2::req_options(http_version = 1.1) |>  # Force HTTP/1.1
    httr2::req_perform()
  
  # Check if response has content before trying to parse JSON
  content_type <- httr2::resp_content_type(resp)
  if(is.na(content_type) || httr2::resp_status(resp) == 204) {
    # No content (204) or no content-type, return NULL
    return(invisible(NULL))
  }
  
  httr2::resp_body_json(resp)
}

#' gbifrules_get
#' @param url helper
#' @param query helper 
#' @param user optional user for authentication, defaults to GBIF_USER env variable
#' @param pwd optional password for authentication, defaults to GBIF_PWD env variable
#' @keywords internal
gbifrules_get <- function(url, query, user = NULL, pwd = NULL) {  
  
  # Use provided credentials or fall back to environment variables
  auth_user <- if(is.null(user)) Sys.getenv("GBIF_USER", "") else user
  auth_pwd <- if(is.null(pwd)) Sys.getenv("GBIF_PWD", "") else pwd
  
  req <- httr2::request(url) |>
    httr2::req_url_query(!!!query) |>
    httr2::req_options(http_version = 1.1)  # Force HTTP/1.1
  
  # Add authentication if credentials are provided
  if (auth_user != "" && auth_pwd != "") {
    req <- req |> httr2::req_auth_basic(auth_user, auth_pwd)
  }
  
  # Return raw list - let caller handle conversion to tibble
  # This preserves NULL values and nested structures
  req |>
    httr2::req_perform() |>
    httr2::resp_body_json()
}

#' gbifrules_put
#' @param url helper
#' @param body helper 
#' @param user optional user for authentication, defaults to GBIF_USER env variable
#' @param pwd optional password for authentication, defaults to GBIF_PWD env variable
#' @keywords internal
gbifrules_put <- function(url, body, user = NULL, pwd = NULL) {
  # Use provided credentials or fall back to environment variables
  auth_user <- if(is.null(user)) Sys.getenv("GBIF_USER", "") else user
  auth_pwd <- if(is.null(pwd)) Sys.getenv("GBIF_PWD", "") else pwd
  
  httr2::request(url) |>
    httr2::req_method("PUT") |>
    httr2::req_auth_basic(auth_user, auth_pwd) |>
    httr2::req_body_json(body) |>
    httr2::req_options(http_version = 1.1) |>  # Force HTTP/1.1
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
    httr2::req_options(http_version = 1.1) |>  # Force HTTP/1.1
    httr2::req_perform() |>
    httr2::resp_body_json() 
}

#' gbifrules_get_id
#' @param url helper
#' @keywords internal
gbifrules_get_id <- function(url) {  
  
  # Wrap entire request in tryCatch to handle any errors
  result <- tryCatch({
    resp <- httr2::request(url) |>
      httr2::req_options(http_version = 1.1) |>  # Force HTTP/1.1
      httr2::req_perform()
    
    # Try to get the body
    body <- tryCatch({
      httr2::resp_body_json(resp)
    }, error = function(e) {
      # Return NULL for any body parsing errors
      return(NULL)
    })
    
    # If body is NULL or empty, return NULL
    if (is.null(body) || length(body) == 0) {
      return(NULL)
    }
    
    # enframe and pivot_wider handle NULL values by converting to NA
    result <- body |>
      tibble::enframe() |>
      tidyr::pivot_wider(names_from="name", values_from = "value")
    
    # Handle list columns - flatten scalar values but keep array fields as lists
    # Define which columns should remain as list columns (arrays/collections)
    array_cols <- c("members", "customVocabulary", "supportedBy", "contestedBy", "basisOfRecord")
    
    # Flatten only non-array list columns
    for (col_name in names(result)) {
      if (is.list(result[[col_name]]) && !col_name %in% array_cols) {
        # Check if this is truly a scalar (all entries have length 0 or 1)
        lengths <- purrr::map_int(result[[col_name]], length)
        is_scalar <- all(lengths <= 1)
        
        if (is_scalar) {
          # Scalar column - extract single values
          result[[col_name]] <- purrr::map(result[[col_name]], ~ if (is.null(.x) || length(.x) == 0) NA else .x[[1L]]) |> unlist()
        }
        # Otherwise keep as list (it's an array with varying lengths)
      }
    }
    
    result
      
  }, error = function(e) {
    # Catch any other errors and return NULL
    return(NULL)
  })
  
  return(result)
}

#' gbifrules_get_id_
#' @param url helper
#' @param user optional user for authentication, defaults to GBIF_USER env variable
#' @param pwd optional password for authentication, defaults to GBIF_PWD env variable
#' @keywords internal
gbifrules_get_id_ <- function(url, user = NULL, pwd = NULL) {  
  
  # Use provided credentials or fall back to environment variables
  auth_user <- if(is.null(user)) Sys.getenv("GBIF_USER", "") else user
  auth_pwd <- if(is.null(pwd)) Sys.getenv("GBIF_PWD", "") else pwd
  
  req <- httr2::request(url) |>
    httr2::req_error(is_error = \(resp) FALSE) |>  # Don't auto-error on HTTP errors
    httr2::req_options(http_version = 1.1)  # Force HTTP/1.1
  
  # Add authentication if credentials are provided
  if (auth_user != "" && auth_pwd != "") {
    req <- req |> httr2::req_auth_basic(auth_user, auth_pwd)
  }
  
  # Disable automatic error handling so we can handle it ourselves
  resp <- req |> 
    httr2::req_error(is_error = \(resp) FALSE) |>
    httr2::req_perform()
  
  # Check status code
  status <- httr2::resp_status(resp)
  
  # Handle not found or no content - return NULL
  if (status == 404 || status == 204) {
    return(NULL)
  }
  
  # Error on non-2xx responses
  if (status >= 400) {
    # Try to extract error message from response body if available
    error_msg <- tryCatch({
      body <- httr2::resp_body_json(resp)
      if (!is.null(body$message)) body$message else paste("HTTP", status)
    }, error = function(e) {
      # If JSON parsing fails, try getting text
      tryCatch(
        httr2::resp_body_string(resp),
        error = function(e2) paste("HTTP", status, "error")
      )
    })
    stop("API request failed (status ", status, "): ", error_msg, call. = FALSE)
  }
  
  # Check content type for successful responses
  content_type <- httr2::resp_content_type(resp)
  if (is.na(content_type)) {
    # No content type header - likely empty response
    return(NULL)
  }
  
  # Parse JSON response for successful 2xx
  httr2::resp_body_json(resp)
  
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
