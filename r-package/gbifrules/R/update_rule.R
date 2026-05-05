#' Update an existing annotation rule
#'
#' @param id (integer) Rule ID to update (required).
#' @param taxonKey (integer) GBIF taxonKey for which rule applies to.
#' @param geometry (character) WKT text string defining the geographic boundary of the rule.
#' @param annotation (character) Annotation type from controlled vocabulary (e.g., "SUSPICIOUS", "INTRODUCED", "NATIVE").
#' @param basisOfRecord (character vector) Optional vector of basis of record values to which the rule applies.
#' @param basisOfRecordNegated (logical) Optional flag to negate the basisOfRecord filter.
#' @param yearRange (character) Optional year range in format "start,end" (e.g., "2000,2023") for temporal filtering.
#' @param rulesetId (character or integer) Optional ID of the ruleset this rule belongs to.
#' @param projectId (character or integer) Optional ID of the project this rule belongs to.
#' @param supportedBy (character vector) Optional vector of user IDs who support this rule.
#' @param contestedBy (character vector) Optional vector of user IDs who contest this rule.
#' @param user (character) Optional username for authentication. Defaults to GBIF_USER environment variable.
#' @param pwd (character) Optional password for authentication. Defaults to GBIF_PWD environment variable.
#' @param ... Additional named parameters to include in the rule payload.
#'
#' @return
#' A list containing the API response with information about the updated rule.
#' 
#' @details
#' Updates an existing annotation rule via the GBIF annotation service API. Only the rule creator
#' or an admin can update a rule. Cannot update deleted rules.
#' 
#' If parameters are left NULL, they will not be updated (existing values will be preserved).
#' 
#' The \\code{annotation} parameter must be from the controlled vocabulary for the project.
#' 
#' The \\code{basisOfRecord} parameter accepts a character vector that will be
#' serialized as a JSON array in the API request.
#' 
#' @export
#'
#' @examples
#' \dontrun{
#' # Update annotation type only
#' update_rule(id = 123, annotation = "NATIVE")
#' 
#' # Update multiple fields
#' update_rule(
#'   id = 123,
#'   annotation = "SUSPICIOUS",
#'   basisOfRecord = c("MACHINE_OBSERVATION"),
#'   projectId = 456
#' )
#' }
update_rule <- function(
                    id = NULL,
                    taxonKey = NULL,
                    geometry = NULL,
                    annotation = NULL,
                    basisOfRecord = NULL,
                    basisOfRecordNegated = NULL,
                    yearRange = NULL,
                    rulesetId = NULL,
                    projectId = NULL,
                    supportedBy = NULL,
                    contestedBy = NULL,
                    user = NULL,
                    pwd = NULL,
                    ...) {

  # Validation
  if (is.null(id)) stop("Must supply rule id")

  # Get existing rule
  existing_rule <- gbifrules_get_id_(paste0(gbifrules_url("rule/"), id), user, pwd)
  
  if (is.null(existing_rule)) {
    stop("Rule not found with id: ", id)
  }

  # Update only provided fields
  if (!is.null(taxonKey)) existing_rule$taxonKey <- as.integer(taxonKey)
  if (!is.null(geometry)) existing_rule$geometry <- as.character(geometry)
  if (!is.null(annotation)) existing_rule$annotation <- as.character(annotation)
  if (!is.null(basisOfRecord)) existing_rule$basisOfRecord <- as.list(as.character(basisOfRecord))
  if (!is.null(basisOfRecordNegated)) existing_rule$basisOfRecordNegated <- as.logical(basisOfRecordNegated)
  if (!is.null(yearRange)) existing_rule$yearRange <- yearRange
  if (!is.null(rulesetId)) existing_rule$rulesetId <- rulesetId
  if (!is.null(projectId)) existing_rule$projectId <- projectId
  if (!is.null(supportedBy)) existing_rule$supportedBy <- supportedBy
  if (!is.null(contestedBy)) existing_rule$contestedBy <- contestedBy

  # Merge any additional named args into body (user-supplied extra properties)
  extras <- list(...)
  if (length(extras) > 0) {
    for (n in names(extras)) {
      existing_rule[[n]] <- extras[[n]]
    }
  }

  # Send to API
  url <- paste0(gbifrules_url("rule/"), id)
  # Use gbifrules_body to compact/flatten where appropriate
  req_body <- gbifrules_body(existing_rule)
  gbifrules_put(url, req_body, user, pwd)
}
