#' Create a new annotation rule
#'
#' @param taxonKey (integer) GBIF taxonKey for which rule applies to (required).
#' @param geometry (character) WKT text string defining the geographic boundary of the rule (required).
#' @param annotation (character) Annotation type from controlled vocabulary (e.g., "SUSPICIOUS", "INTRODUCED", "NATIVE") (required).
#' @param basisOfRecord (character vector) Optional vector of basis of record values to which the rule applies (e.g., c("MACHINE_OBSERVATION", "HUMAN_OBSERVATION")).
#' @param basisOfRecordNegated (logical) Optional flag to negate the basisOfRecord filter.
#' @param yearRange (character) Optional year range in format "start,end" (e.g., "2000,2023") for temporal filtering.
#' @param rulesetId (character or integer) Optional ID of the ruleset this rule belongs to.
#' @param projectId (character or integer) Optional ID of the project this rule belongs to.
#' @param supportedBy (character vector) Optional vector of user IDs who support this rule.
#' @param contestedBy (character vector) Optional vector of user IDs who contest this rule.
#' @param created (character) Optional creation timestamp (ISO format).
#' @param createdBy (character) Optional user ID of rule creator. If not provided, automatically set from GBIF_USER environment variable.
#' @param deleted (character) Optional deletion timestamp (ISO format).
#' @param deletedBy (character) Optional user ID who deleted the rule.
#' @param ... Additional named parameters to include in the rule payload.
#'
#' @return
#' A list containing the API response with information about the created rule.
#' 
#' @details
#' Creates a new annotation rule via the GBIF annotation service API. The rule defines
#' a geographic area (via WKT geometry) and taxonomic scope (via taxonKey) where
#' occurrences should be flagged with the specified annotation type.
#' 
#' The \code{annotation} parameter must be from the controlled vocabulary (e.g.,
#' "SUSPICIOUS", "INTRODUCED", "NATIVE"). 
#' 
#' The \code{basisOfRecord} parameter accepts a character vector that will be
#' serialized as a JSON array in the API request.
#' 
#' @export
#'
#' @examples
#' \dontrun{
#' # Simple rule with required parameters
#' make_rule(
#'   taxonKey = 1,
#'   geometry = "POLYGON ((30 10, 40 40, 20 40, 10 20, 30 10))", 
#'   annotation = "NATIVE"
#' )
#' 
#' # Complex rule with basis of record filter
#' make_rule(
#'   taxonKey = 12345,
#'   geometry = "POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))",
#'   annotation = "SUSPICIOUS",
#'   basisOfRecord = c("MACHINE_OBSERVATION", "HUMAN_OBSERVATION"),
#'   createdBy = "user@example.com"
#' )
#' }
make_rule <- function(
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
                    created = NULL,
                    createdBy = NULL,
                    deleted = NULL,
                    deletedBy = NULL,
                    ...) {

  # Basic validation
  if (is.null(taxonKey)) stop("please supply taxonKey")
  if (is.null(geometry)) stop("please supply geometry")
  if (is.null(annotation)) stop("please supply annotation")

  # Set default createdBy from environment variable if not provided
  if (is.null(createdBy)) {
    createdBy <- Sys.getenv("GBIF_USER", "")
  }

  # Build request body with allowed fields. Preserve vectors (e.g. basisOfRecord)
  body <- list(
    taxonKey = as.integer(taxonKey),
    geometry = as.character(geometry),
    annotation = as.character(annotation)
  )

    if (!is.null(basisOfRecord)) body$basisOfRecord <- as.list(as.character(basisOfRecord))
	if (!is.null(basisOfRecordNegated)) body$basisOfRecordNegated <- as.logical(basisOfRecordNegated)
	if (!is.null(yearRange)) body$yearRange <- yearRange
	if (!is.null(rulesetId)) body$rulesetId <- rulesetId
	if (!is.null(projectId)) body$projectId <- projectId
	if (!is.null(supportedBy)) body$supportedBy <- supportedBy
	if (!is.null(contestedBy)) body$contestedBy <- contestedBy
	if (!is.null(created)) body$created <- created
	if (!is.null(createdBy)) body$createdBy <- createdBy
	if (!is.null(deleted)) body$deleted <- deleted
	if (!is.null(deletedBy)) body$deletedBy <- deletedBy

	# Merge any additional named args into body (user-supplied extra properties)
	extras <- list(...)
	if (length(extras) > 0) {
		# do not overwrite existing fields unless explicitly provided
		for (n in names(extras)) {
			body[[n]] <- extras[[n]]
		}
	}

	# Send to API
	url <- gbifrules_url("rule")
	# Use gbifrules_body to compact/flatten where appropriate
	req_body <- gbifrules_body(body)
	gbifrules_post(url, req_body)
}

