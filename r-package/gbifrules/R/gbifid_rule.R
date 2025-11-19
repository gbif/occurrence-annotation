#' Make an annotations using gbifid
#'
#' @param gbifId gbifId 
#' @param rulesetId rulesetId
#' @param projectId projectId
#' @param buffer how much to buffer the bound box by. 
#' @param annotation annoations
#' @param create_rule debugging delogical asking whether rule should be 
#' written to database. 
#' @return A `list` of info about the rule. 
#' @details
#' It isn't possible to attach annotations directly to gbifIds. However, it is 
#' possible to create a rule that captures almost the same thing by making a small 
#' bounding box around the lat-lon of the occurrence and indicating the 
#' datasetKey. This will accomplish close to same thing as attaching the 
#' annotations to the gbifId. 
#' 
#' @export
#' 
#' @examples
#' \dontrun{
#' gbifid_rule(1986620884,projectId = 1,rulesetId=1,create_rule=FALSE)
#' }
gbifid_rule <- function(gbifId = NULL,
                        rulesetId = NULL,
                        projectId = NULL,
                        buffer = 1000,
                        annotation="SUSPICIOUS",
                        create_rule = TRUE
                        ) {
  
  d <- rgbif::occ_get(gbifId)[[1]]$data
  datasetKey <- d$datasetKey
  taxonKey <- rgbif::name_backbone(d$scientificName)$usageKey
  
  lat <- d$decimalLatitude
  lon <- d$decimalLongitude
  point <- sf::st_point(c(lon, lat), dim = "XY")
  point_sf <- sf::st_sfc(point, crs = 4326)
  buffered_point <- sf::st_buffer(point_sf, dist = buffer)
  bbox <- sf::st_bbox(buffered_point) 
  
  bbox_polygon <- sf::st_polygon(list(matrix(c(
    bbox["xmin"], bbox["ymin"],
    bbox["xmin"], bbox["ymax"],
    bbox["xmax"], bbox["ymax"],
    bbox["xmax"], bbox["ymin"],
    bbox["xmin"], bbox["ymin"]
  ), ncol = 2, byrow = TRUE)))
  
  bbox_sf <- sf::st_sfc(bbox_polygon, crs = 4326)
  wkt <- sf::st_as_text(bbox_sf)
  
  if(is.null(rulesetId)) stop("Please supply a rulesetId.")
  if(is.null(projectId)) projectId <- get_ruleset(rulesetId)$projectId
  
  if(create_rule) {
  make_rule(projectId = projectId,
            rulesetId = rulesetId,
            datasetKey = datasetKey,
            taxonKey = taxonKey,
            geometry = wkt,
            annotation = annotation)
  } else {
    list(projectId = projectId,
         rulesetId = rulesetId,
         datasetKey = datasetKey,
         taxonKey = taxonKey,
         geometry = wkt,
         annotation = annotation)
  } 
}
