#' Clean a GBIF download of supicious records 
#'
#' @param d a GBIF download in DWCA format 
#' @param rm_suspicious removes records with suspicious speciesKey
#' @param rm_higher_order_suspicious removes records with suspicious higher order keys
#'
#' @return A cleaned download `data.frame()`
#' @description
#' Removes records that have been marked as suspicious by annotation users. 
#' 
#' 
#' @export
#'
#' @examples \dontrun{
#' library(rgbif)
#' # End to end example with GBIF download and cleaning
#' 
#' # Ambystoma mexicanum
#' occ_download(
#' pred(taxonKey,"2431950"),
#' pred_default()
#' format = "SIMPLE_CSV"
#' )
#' 
#' # Calopteryx 
#' # 0051416-241126133413365
#' # simple polygons not inverted 
#' # 0049858-241126133413365
#' # inverted polygon 
#' # 0049850-241126133413365
#' d <- occ_download_get('0051416-241126133413365') %>%
#'  occ_download_import()
#' 
#' clean_download(d) 
#' }
#' 
#' 
clean_download <- function(d,
                           rm_suspicious=TRUE,
                           rm_higher_order_suspicious=TRUE,
                           handle_conflicts="favor_supicious") {
  d_org <- d |>
    dplyr::filter(!is.na(decimalLongitude) | !is.na(decimalLatitude)) |>
    dplyr::mutate(lon = decimalLongitude) |>
    dplyr::mutate(lat = decimalLatitude) |>
    dplyr::mutate(id=paste(taxonKey,lat,lon,sep="_")) 
  
  d <- d |>
    dplyr::select(c(
             "decimalLongitude",
             "decimalLatitude",
             "taxonKey",
             "taxonRank",
             "kingdomKey",
             "phylumKey",
             "classKey",
             "orderKey",
             "familyKey",
             "genusKey",
             "speciesKey",
             "taxonKey")) |>
    dplyr::mutate(lon = decimalLongitude) |>
    dplyr::mutate(lat = decimalLatitude) |>
    unique() 
  
    dr <- lapply(
      list("speciesKey",
           "genusKey",
           "familyKey",
           "orderKey",
           "classKey",
           "phylumKey",
           "kingdomKey"),
           function(x) {
      
      get_rules_from_downoad(d,key=x) 
      
      }) |> 
      dplyr::bind_rows() 

    # post process to eliminate duplicates 
    dr <- dplyr::group_split(dr,id) |> 
      purrr::map(~ {
        lapply(.x,function(x) {
          z <- unique(na.omit(x))
          if(length(z) == 0) FALSE else z
          })
      }) |>
      purrr::map(~ data.frame(.x)) |> 
       dplyr::bind_rows()
    
    if("annotation_speciesKey_SUSPICIOUS" %in% names(dr)) {
      dr <- dr |> mutate(is_supicious = annotation_speciesKey_SUSPICIOUS) 
    } else {
      dr <- dr |> mutate(is_supicious = FALSE)
    }
    
    # handle the case where the annotation_speciesKey_SUSPICIOUS column is not present
    sus_cols <- c("annotation_genusKey_SUSPICIOUS",
                  "annotation_familyKey_SUSPICIOUS",
                  "annotation_orderKey_SUSPICIOUS",
                  "annotation_classKey_SUSPICIOUS",
                  "annotation_phylumKey_SUSPICIOUS",
                  "annotation_kingdomKey_SUSPICIOUS")
    
    if(any(sus_cols %in% names(dr))) {
      
      dr <- dr %>%
        rowwise() %>%
        mutate(higher_order_suspicious = any(c_across(any_of(sus_cols)))) %>%
        ungroup()
      
    } else {
      dr <- dr |> mutate(higher_order_suspicious = FALSE)  
    }
    
    # check and handle conflicts 
    # conflicts <- dr |> group_by(id) |> count() |> filter(n > 1)
    dr <- dr |> mutate(has_conflict = duplicated(id))
    
    if(any(dr$has_conflict)) {
      message("Conflicts in the data")
    if(handle_conflicts == "favor_supicious") {
      message("handling conflicts by favoring supicious records")
      dr <- dr |> filter((is_supicious & has_conflict) | !has_conflict)
      dr <- dr |> mutate(has_conflict = duplicated(id))
      dr <- dr |> filter((higher_order_suspicious & has_conflict) | !has_conflict)
      dr <- dr |> mutate(has_conflict = duplicated(id))
      if(any(dr$has_conflict)) message("Still conflicts in the data")
    }
    }
    
  out <- d_org |>
    merge(dr,by="id",all.y=TRUE) |>
    dplyr::select(-id)
  
  if(rm_suspicious) {
    out <- out |>
      dplyr::filter(!is_supicious)
  }
  if(rm_higher_order_suspicious) {
    out <- out |>
      dplyr::filter(!higher_order_suspicious)
  }
  out <- out |>
    dplyr::select(-lat,-lon)
  
  # compute stats 
  n_records_org <- nrow(d_org)
  n_records_removed <- nrow(d_org) - nrow(out)
  n_records_removed_pct <- n_records_removed / nrow(d_org) * 100
  n_records_removed_pct <- round(n_records_removed_pct,4)
  
  n_NATIVE <- out |> 
    dplyr::select(contains("NATIVE")) |> 
    dplyr::filter(if_any(everything(), ~ .x == TRUE)) |>
    nrow()
  
  n_INTRODUCED <- out |> 
    dplyr::select(contains("INTRODUCED")) |> 
    dplyr::filter(if_any(everything(), ~ .x == TRUE)) |>
    nrow()
  
  ann_download <- structure(out, class = c("ann_download", class(out)))
  attr(ann_download, "n_NATIVE") <- n_NATIVE
  attr(ann_download, "n_INTRODUCED") <- n_INTRODUCED
  
  attr(ann_download, "n_records_removed") <- n_records_removed
  attr(ann_download, "n_records_removed_pct") <- n_records_removed_pct
  attr(ann_download, "n_records_org") <- n_records_org
  ann_download
}

get_rules_from_downoad <- function(d,key) {
  
  d = na.omit(d[c("decimalLongitude",
                  "decimalLatitude",
                  "lon",
                  "lat",
                  "taxonKey",key)])
  d_split = split(d,d[key])
  
  lapply(d_split,function(x) {
    
    taxonKey <- x[[key]][1]
    d_sf <- x %>% sf::st_as_sf(coords = c("decimalLongitude", "decimalLatitude"), crs = 4326)
    
    r <- get_rule(taxonKey = taxonKey)
    if(!length(r) == 0) {
      r |>
        dplyr::group_split(id) |>
        purrr::map(~{
          annotation <- paste0("annotation_",key,"_",unique(.x$annotation))
          
          is_inverted <- grepl("18090909009090901809018090909009090901809018090",
                               gsub("[ ,-]", "",.x$geometry))
          polygon <- .x |>
            dplyr::mutate(geometry = sf::st_as_sfc(geometry , crs = 4326)) |>
            sf::st_sf() |>
            sf::st_geometry() |>
            sf::st_combine() |>
            sf::st_make_valid()
        
          if(is_inverted) {
          within <- sf::st_within(d_sf, polygon, sparse = FALSE) |> as.vector() %>% !.
          } else {
          within <- sf::st_within(d_sf, polygon, sparse = FALSE) |> as.vector() 
          }  
          
          # plot for debugging
          # library(ggplot2)
          # library(sf)
          # p <- ggplot() +
            # geom_sf(data = polygon, fill = "lightblue", color = "black") +
            # geom_sf(data = d_sf) +
            # theme_minimal() +
            # labs(title = is_inverted,caption=paste(within,collapse=","),subtitle = annotation)
          # print(p)
          
          d_sf |>
            as.data.frame() |>
            dplyr::mutate(!!annotation := within) |>
            dplyr::mutate(id=paste(taxonKey,lat,lon,sep="_")) |>
            dplyr::select(id,contains("annotation")) 
        })
    }
  }) |> 
    dplyr::bind_rows()
}

#' @method print ann_download
#' @export
print.ann_download <- function(x, ...) {
  cat("─ Annotations Stats ───────────────────────\n")
  cat("Number NATIVE of records in cleaned download: ", attr(x, "n_NATIVE"), "\n")
  cat("Number INTRODUCED of records in cleaned download: ", attr(x, "n_INTRODUCED"), "\n")
  cat("─ Cleaning Summary ────────────────────────\n")
  cat("Number of records in original download: ", attr(x, "n_records_org"), "\n")
  cat("Number of suspicous records: ", attr(x, "n_records_removed"), "\n")
  cat("Percentage of suspicous : ", attr(x, "n_records_removed_pct"), "%\n")
}



