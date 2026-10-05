#' Triage one GBIF occurrence record
#'
#' Fetches a GBIF occurrence with `rgbif::occ_get()`, assesses it with a
#' low-cost OpenAI model, and sends only `NEEDS_REVIEW` results to the advanced
#' model. Both assessments are returned; no occurrence or annotation data is
#' written back to GBIF.
#'
#' @param occurrenceKey numeric or character GBIF occurrence key.
#' @param apiKey OpenAI API key. Defaults to the `OPENAI_API_KEY` environment
#'   variable.
#'
#' @return A list with `occurrenceKey`, the GBIF `record`, `initialAssessment`,
#'   optional `advancedAssessment`, and `finalAssessment`.
#' @export
assess_occurrence_record <- function(occurrenceKey,
                                     apiKey = Sys.getenv("OPENAI_API_KEY")) {
  if (length(occurrenceKey) != 1 || is.na(occurrenceKey) ||
      !grepl("^[0-9]+$", as.character(occurrenceKey))) {
    stop("occurrenceKey must be a positive integer key.")
  }
  occurrence_key <- as.numeric(occurrenceKey)
  if (!is.finite(occurrence_key) || occurrence_key < 1) {
    stop("occurrenceKey must be a positive integer key.")
  }
  if (!is.character(apiKey) || length(apiKey) != 1 || is.na(apiKey) || !nzchar(apiKey)) {
    stop("Set OPENAI_API_KEY or provide apiKey.")
  }

  record <- .fetch_occurrence_record(occurrence_key)
  centroid_context <- .country_centroid_context(record)
  input <- list(occurrenceKey = occurrenceKey, record = record)
  if (!is.null(centroid_context)) input$countryCentroidContext <- centroid_context

  initial <- .request_record_triage(
    apiKey = apiKey,
    model = "gpt-4.1-mini",
    instructions = .record_triage_prompt,
    input = input,
    maxOutputTokens = 400
  )
  advanced <- NULL
  if (initial$decision == "NEEDS_REVIEW") {
    advanced <- .request_record_triage(
      apiKey = apiKey,
      model = "gpt-5.6-terra",
      instructions = .advanced_record_triage_prompt,
      input = list(
        occurrenceKey = occurrenceKey,
        record = record,
        countryCentroidContext = centroid_context,
        initialAssessment = initial
      ),
      maxOutputTokens = 4000,
      reasoningEffort = "high"
    )
  }

  list(
    occurrenceKey = occurrence_key,
    record = record,
    initialAssessment = initial,
    advancedAssessment = advanced,
    finalAssessment = if (is.null(advanced)) initial else advanced
  )
}

.record_triage_reasons <- c(
  "captive_or_managed",
  "locality_coordinate_mismatch",
  "unlikely_location_for_taxon",
  "country_centroid_anomaly",
  "dataset_quality_concern",
  "taxonomic_or_identification_mismatch",
  "introduced_population",
  "other",
  "insufficient_information",
  "none"
)

.record_triage_schema <- list(
  type = "object",
  properties = list(
    decision = list(type = "string", enum = c("SUSPICIOUS", "INTRODUCED", "OK", "NEEDS_REVIEW")),
    reason_category = list(type = "string", enum = .record_triage_reasons),
    explanation = list(type = "string")
  ),
  required = c("decision", "reason_category", "explanation"),
  additionalProperties = FALSE
)

.native_range_review_policy <- paste(
  "First identify the focal accepted taxon using acceptedScientificName or",
  "scientificName, taxonRank, and classification. Recall its native range from",
  "your pretrained biogeographic knowledge: regions, countries, islands, and",
  "habitat where confidently known. Do not substitute a genus or family range",
  "for a species range or guess the distribution of an unfamiliar taxon.",
  "Then compare the supplied coordinates and locality with that recalled range,",
  "allowing for coordinate uncertainty, historical range, and plausible vagrancy.",
  "A clear location very far outside a confidently recalled native range is",
  "SUSPICIOUS with reason unlikely_location_for_taxon unless a plausible",
  "free-ranging introduced population or other credible natural explanation is",
  "supported by the record or confidently recalled knowledge. Do not require",
  "explicit proof of captivity to flag this geographic mismatch, and do not",
  "infer captivity or an introduced population solely from being outside the range.",
  "Retain INTRODUCED for an otherwise plausible, supported free-ranging established",
  "introduced population; explicit non-wild evidence remains SUSPICIOUS.",
  "Use NEEDS_REVIEW when native-range knowledge or taxonomic identity is uncertain,",
  "the point is near an uncertain range edge, or coordinate uncertainty could",
  "overlap plausible range. Country-centroid distance is not native-range distance.",
  "Distinguish supplied record facts from model-recalled range knowledge: the latter",
  "is not externally verified. For a range-based decision, name the recalled range",
  "and contrast it with the record location in the one-sentence explanation.",
  "Do not invent record details, introduction evidence, or source citations.",
  sep = " "
)

.record_triage_prompt <- paste(
  "Triage one GBIF occurrence record selected as a geographic outlier.",
  .native_range_review_policy,
  "Assess the supplied GBIF record and country-centroid context using that policy.",
  "Do not infer absence from GBIF.",
  "Centroid distance alone is never suspicious. Use country_centroid_anomaly",
  "only when locality is country-only or unspecified, uncertainty is at least",
  "1,000,000 metres, and the point is within 500 km and within 25% of the",
  "uncertainty radius from the centroid.",
  "For datasetName exactly NABU|naturgucker, scrutinize coordinates, uncertainty,",
  "verbatim coordinates, georeferencing, locality, and country consistency.",
  "The dataset name alone is not proof of an error; use dataset_quality_concern",
  "only with corroborating record-level evidence, otherwise NEEDS_REVIEW.",
  "SUSPICIOUS means non-wild (captive, zoo, garden, cultivated, managed) or",
  "concrete record-level data error or a clear native-range mismatch under the",
  "range policy above. INTRODUCED means an otherwise plausible,",
  "free-ranging established introduced population. OK requires positive context",
  "supporting a plausible wild occurrence. NEEDS_REVIEW is the default for",
  "incomplete, ambiguous, conflicting, or unexplained outlier evidence.",
  "Use reason none only for OK and introduced_population for INTRODUCED.",
  "Return one short sentence. Do not invent record facts or write data to GBIF.",
  sep = " "
)

.advanced_record_triage_prompt <- paste(
  "You are the advanced reviewer for an occurrence that the fast triage model",
  "marked NEEDS_REVIEW. Independently review the original GBIF record, country",
  "centroid context, and initial assessment. Do not defer to the initial model.",
  .native_range_review_policy,
  "Independently reconsider the native range; do not treat the fast model's",
  "range description as verified evidence.",
  "Apply the same decision definitions: SUSPICIOUS for non-wild records or a",
  "concrete data error or a clear native-range mismatch under the policy above;",
  "INTRODUCED for a plausible free-ranging established",
  "introduced population; OK only with positive context supporting a plausible",
  "wild record; NEEDS_REVIEW when evidence is incomplete or ambiguous.",
  "Country-centroid distance and the NABU|naturgucker dataset name are supporting",
  "signals only; use their specific reason categories only with the documented",
  "corroborating conditions. Return one short sentence; do not invent record",
  "facts or write data to GBIF.",
  sep = " "
)

.fetch_occurrence_record <- function(occurrenceKey) {
  response <- rgbif::occ_get(key = occurrenceKey, fields = "all")
  if (!length(response) || is.null(response[[1]]$data) || nrow(response[[1]]$data) != 1) {
    stop("GBIF did not return exactly one occurrence record for key ", occurrenceKey, ".")
  }
  occurrence <- response[[1]]
  data <- occurrence$data
  record <- lapply(data, function(column) column[[1]])
  names(record) <- names(data)

  if (!is.null(occurrence$hierarchy) && nrow(occurrence$hierarchy) > 0) {
    hierarchy <- occurrence$hierarchy
    record$classification <- lapply(seq_len(nrow(hierarchy)), function(row) {
      as.list(hierarchy[row, , drop = FALSE])
    })
  }
  media <- occurrence$media[[as.character(occurrenceKey)]]
  if (length(media)) {
    record$media <- lapply(media, function(item) {
      item[intersect(c("type", "format", "references", "identifier"), names(item))]
    })
  }
  record
}

.country_centroid_context <- function(record) {
  country_code <- record$countryCode
  if (is.null(country_code) || length(country_code) != 1 || is.na(country_code)) return(NULL)
  path <- system.file("extdata", "country_polygons.json", package = "gbifout")
  if (!nzchar(path) || !file.exists(path)) return(NULL)
  countries <- tryCatch(jsonlite::fromJSON(path), error = function(e) NULL)
  if (is.null(countries) || !"iso2" %in% names(countries)) return(NULL)
  row <- which(toupper(countries$iso2) == toupper(as.character(country_code)))[1]
  if (is.na(row)) return(NULL)

  longitude <- suppressWarnings(as.numeric(record$decimalLongitude))
  latitude <- suppressWarnings(as.numeric(record$decimalLatitude))
  if (length(longitude) != 1 || length(latitude) != 1 ||
      !is.finite(longitude) || !is.finite(latitude)) return(NULL)

  context <- tryCatch({
    boundary <- sf::st_as_sfc(countries$wkt[row], crs = 4326)
    centroid <- sf::st_transform(boundary, 8857) |>
      sf::st_centroid() |>
      sf::st_transform(4326)
    point <- sf::st_sfc(sf::st_point(c(longitude, latitude)), crs = 4326)
    centroid_coordinates <- sf::st_coordinates(centroid)[1, ]
    distance_km <- as.numeric(sf::st_distance(point, centroid)) / 1000
    list(
      countryCode = as.character(country_code),
      countryName = countries$name[row],
      centroid = list(
        longitude = round(centroid_coordinates[["X"]], 5),
        latitude = round(centroid_coordinates[["Y"]], 5)
      ),
      distanceFromCentroidKm = round(distance_km, 1),
      note = "Approximate equal-area centroid of the packaged country boundary; supporting context only."
    )
  }, error = function(e) NULL)
  context
}

.request_record_triage <- function(apiKey, model, instructions, input,
                                   maxOutputTokens, reasoningEffort = NULL) {
  body <- list(
    model = model,
    instructions = instructions,
    input = as.character(jsonlite::toJSON(input, auto_unbox = TRUE, null = "null", na = "null")),
    max_output_tokens = maxOutputTokens,
    text = list(format = list(
      type = "json_schema",
      name = "occurrence_triage",
      strict = TRUE,
      schema = .record_triage_schema
    ))
  )
  if (!is.null(reasoningEffort)) body$reasoning <- list(effort = reasoningEffort)

  response <- httr2::request("https://api.openai.com/v1/responses") |>
    httr2::req_headers(Authorization = paste("Bearer", apiKey)) |>
    httr2::req_body_json(body, auto_unbox = TRUE, null = "null", na = "null") |>
    httr2::req_perform()
  payload <- httr2::resp_body_json(response, simplifyVector = FALSE)
  if (!identical(payload$status, "completed")) {
    status <- payload$status
    if (is.null(status)) status <- "unknown"
    stop("OpenAI triage response was not completed (status=", status, ").")
  }

  text <- .record_response_text(payload)
  assessment <- .parse_record_triage(text)
  assessment$model <- model
  assessment
}

.record_response_text <- function(payload) {
  output <- payload$output
  if (!is.list(output)) output <- list()
  messages <- Filter(function(item) identical(item$type, "message"), output)
  content <- unlist(lapply(messages, function(item) item$content), recursive = FALSE)
  text_items <- Filter(function(item) identical(item$type, "output_text"), content)
  text <- vapply(text_items, function(item) {
    value <- item$text
    if (is.character(value) && length(value) == 1) value else NA_character_
  }, character(1))
  text <- text[!is.na(text) & nzchar(trimws(text))]
  if (length(text)) return(paste(text, collapse = ""))

  status <- payload$status
  if (is.null(status)) status <- "unknown"
  output_types <- vapply(output, function(item) {
    type <- item$type
    if (is.character(type) && length(type) == 1) type else "unknown"
  }, character(1))
  has_refusal <- any(vapply(content, function(item) identical(item$type, "refusal"), logical(1)))
  message <- if (has_refusal) {
    "OpenAI declined the structured triage response"
  } else {
    "OpenAI triage response contained no non-empty output_text"
  }
  stop(message, " (status=", status, ", output_types=[",
       paste(output_types, collapse = ","), "]).")
}

.parse_record_triage <- function(text) {
  result <- jsonlite::fromJSON(text, simplifyVector = FALSE)
  decisions <- c("SUSPICIOUS", "INTRODUCED", "OK", "NEEDS_REVIEW")
  if (!is.list(result) || !result$decision %in% decisions ||
      !result$reason_category %in% .record_triage_reasons ||
      !is.character(result$explanation) || length(result$explanation) != 1 ||
      !nzchar(trimws(result$explanation))) {
    stop("OpenAI returned an invalid occurrence triage result.")
  }
  list(
    decision = result$decision,
    reasonCategory = result$reason_category,
    explanation = trimws(result$explanation)
  )
}