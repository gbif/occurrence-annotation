#' Build a reusable species distribution evidence profile
#'
#' Resolves the taxon with GBIF and makes one paid strong-model request.
#' Distribution claims are unverified model knowledge, not retrieved sources.
#' Save the result with `saveRDS()` to inspect, edit, and reuse it.
#'
#' @param taxonKey GBIF taxon usage key.
#' @param model strong-model API identifier (default `"gpt-5.6-terra"`).
#' @param apiKey OpenAI API key.
#' @return A list with resolved `taxon`, `taxonKey`, structured `distribution`,
#'   `evidenceBasis`, `sources`, `model`, and UTC `created` time. To supply a
#'   reviewed profile, edit its claims, set `evidenceBasis = "user_reviewed"`,
#'   and record consulted sources in the character vector `sources`.
#' @export
species_context <- function(taxonKey, model = "gpt-5.6-terra",
                            apiKey = Sys.getenv("OPENAI_API_KEY")) {
  .species_text(taxonKey, "taxonKey", allow_numeric = TRUE)
  .species_text(model, "model")
  .species_text(apiKey, "apiKey")
  taxon <- rgbif::name_backbone(usageKey = as.character(taxonKey), strict = TRUE)
  if (!is.data.frame(taxon) || nrow(taxon) != 1 ||
      !all(c("usageKey", "scientificName", "rank") %in% names(taxon)) ||
      !identical(as.character(taxon$usageKey), as.character(taxonKey))) {
    stop("GBIF did not resolve the requested taxonKey exactly; check its taxonomy.")
  }
  taxon <- lapply(taxon, function(column) column[[1]])
  .species_text(taxon$scientificName, "resolved scientificName")
  .species_text(taxon$rank, "resolved rank")
  text <- .request_structured_response(
    apiKey = apiKey, model = model, instructions = .species_context_prompt,
    input = list(taxonKey = as.character(taxonKey), taxon = taxon),
    maxOutputTokens = 4000, reasoningEffort = "high",
    schema = .species_context_schema, schemaName = "species_distribution"
  )
  profile <- list(
    taxonKey = as.character(taxonKey), taxon = taxon,
    distribution = jsonlite::fromJSON(text, simplifyVector = FALSE),
    evidenceBasis = "model_knowledge_unverified", sources = character(),
    model = model, created = format(Sys.time(), tz = "UTC", usetz = TRUE)
  )
  .validate_species_context(profile, taxonKey)
  profile
}

.species_text <- function(value, name, allow_numeric = FALSE) {
  if (!(is.character(value) || (allow_numeric && is.numeric(value))) ||
      length(value) != 1 || is.na(value) || !nzchar(trimws(as.character(value)))) {
    stop(name, " must be a single non-empty value.")
  }
}

.species_distribution_fields <- c(
  "nativeRange", "introducedRange", "habitat", "elevation",
  "vagrancyAndExpansion", "historicalRange", "taxonomicCaveats", "knowledgeGaps"
)

.species_context_schema <- list(
  type = "object",
  properties = c(
    stats::setNames(lapply(.species_distribution_fields, function(name) {
      list(type = "string")
    }), .species_distribution_fields),
    list(confidence = list(type = "string", enum = c("low", "medium", "high")))
  ),
  required = c(.species_distribution_fields, "confidence"),
  additionalProperties = FALSE
)

.validate_species_context <- function(profile, taxonKey = NULL) {
  if (!is.list(profile) || !is.list(profile$taxon) ||
      !is.list(profile$distribution)) {
    stop("speciesContext must be a species_context() profile.")
  }
  for (field in c("taxonKey", "evidenceBasis", "model", "created")) {
    .species_text(profile[[field]], paste0("speciesContext$", field))
  }
  for (field in c("usageKey", "scientificName", "rank")) {
    .species_text(profile$taxon[[field]], paste0("speciesContext$taxon$", field),
                  allow_numeric = field == "usageKey")
  }
  if (!identical(as.character(profile$taxon$usageKey), profile$taxonKey)) {
    stop("speciesContext taxonKey does not match its resolved taxon.")
  }
  if (!is.null(taxonKey) && !identical(profile$taxonKey, as.character(taxonKey))) {
    stop("speciesContext taxonKey does not match the requested taxonKey.")
  }
  if (!profile$evidenceBasis %in% c("model_knowledge_unverified", "user_reviewed") ||
      !is.character(profile$sources) || anyNA(profile$sources) ||
      any(!nzchar(trimws(profile$sources)))) {
    stop("speciesContext must declare its evidenceBasis and character sources.")
  }
  for (field in .species_distribution_fields) {
    .species_text(profile$distribution[[field]], paste0("speciesContext$distribution$", field))
  }
  .species_text(profile$distribution$confidence, "speciesContext$distribution$confidence")
  if (!profile$distribution$confidence %in% c("low", "medium", "high")) {
    stop("speciesContext confidence must be low, medium or high.")
  }
  invisible(profile)
}

.species_context_prompt <- paste(
  "Prepare a species distribution evidence profile for the supplied resolved",
  "GBIF taxon. Use acceptedScientificName when supplied; preserve the taxonomic",
  "concept and rank. Do not substitute the range of a genus for a species.",
  "Use your pretrained knowledge only; no external sources have been retrieved.",
  "Do not invent citations or imply that claims were externally verified.",
  "Describe native range with meaningful subnational limits, islands, and",
  "exclusions where confidently known; a country is not uniformly occupied.",
  "Separate established introduced populations from native range, vagrancy,",
  "and natural expansion. Include habitat, elevation, historical occurrence,",
  "synonym/split ambiguities, confidence and knowledge gaps.",
  "Write 'Unknown' for unsupported information rather than guessing.",
  "This is supporting context for reviewing records, not a definitive range map",
  "or an exhaustive list whose omissions prove absence. Return the structured profile."
)

.record_matches_species_context <- function(record, profile) {
  name <- record$acceptedScientificName
  if (is.null(name) || length(name) != 1 || is.na(name) || !nzchar(name)) {
    name <- record$scientificName
  }
  rank <- record$taxonRank
  if (!is.character(name) || length(name) != 1 || is.na(name) || !nzchar(name) ||
      !is.character(rank) || length(rank) != 1 || is.na(rank) || !nzchar(rank)) {
    return(FALSE)
  }
  query <- list(name = name, rank = rank, strict = TRUE)
  checklist <- profile$taxon$verbatim_checklistKey
  if (!is.null(checklist)) query$checklistKey <- checklist
  for (field in c("kingdom", "phylum", "class", "order", "family", "genus")) {
    value <- record[[field]]
    if (is.character(value) && length(value) == 1 && !is.na(value) && nzchar(value)) {
      query[[field]] <- value
    }
  }
  resolved <- tryCatch(
    do.call(rgbif::name_backbone, query),
    error = function(error) {
      stop("Record taxon cross-check failed: ", conditionMessage(error), call. = FALSE)
    }
  )
  if (!is.data.frame(resolved) || nrow(resolved) != 1 ||
      !all(c("usageKey", "rank", "matchType") %in% names(resolved)) ||
      !identical(as.character(resolved$matchType), "EXACT") ||
      !identical(toupper(as.character(resolved$rank)), toupper(rank))) {
    return(FALSE)
  }
  keys <- c("usageKey", "acceptedUsageKey", "speciesKey", "genusKey",
            "familyKey", "orderKey", "classKey", "phylumKey", "kingdomKey")
  resolved_keys <- as.character(unlist(resolved[intersect(keys, names(resolved))],
                                       use.names = FALSE))
  profile_keys <- as.character(c(profile$taxonKey, profile$taxon$acceptedUsageKey))
  resolved_keys <- resolved_keys[!is.na(resolved_keys) & nzchar(resolved_keys)]
  profile_keys <- profile_keys[!is.na(profile_keys) & nzchar(profile_keys)]
  any(resolved_keys %in% profile_keys)
}
