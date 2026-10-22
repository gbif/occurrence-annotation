#' Triage one GBIF occurrence record
#'
#' Fetches a GBIF occurrence with `rgbif::occ_get()`, assesses it with a
#' low-cost OpenAI model, and sends only `NEEDS_REVIEW` results to the advanced
#' model. Both assessments are returned; no occurrence or annotation data is
#' written back to GBIF.
#' Valid coordinates are reverse-geocoded once with `rgbif::gbif_geocode()`;
#' both reviewers receive the returned polygon evidence.
#'
#' @param occurrenceKey numeric or character GBIF occurrence key.
#' @param apiKey OpenAI API key. Defaults to the `OPENAI_API_KEY` environment
#'   variable.
#' @param candidates optional `out_cand()` result. Country and continent
#'   occurrence counts within its combined HDP area are fetched using its
#'   taxon and basis-of-record filter and sent to both models as supporting
#'   distribution context, not as a native-range determination.
#'
#' @return A list with `occurrenceKey`, the GBIF `record`, `initialAssessment`,
#'   optional `advancedAssessment`, and `finalAssessment`. When `candidates`
#'   is supplied, also includes `hdpFacetContext` with the counts sent.
#'   `geocodeContext` retains the reverse-geocoder results and coverage status.
#' @export
occ_agent <- function(occurrenceKey,
                      candidates = NULL,
                      apiKey = Sys.getenv("OPENAI_API_KEY")
                      ) {
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
  hdp_context <- if (!is.null(candidates)) .hdp_facet_context(candidates) else NULL

  record <- .fetch_occurrence_record(occurrence_key)
  geocode_context <- .record_geocode_context(record)
  centroid_context <- .country_centroid_context(record)
  input <- list(occurrenceKey = occurrenceKey, record = record,
                geocodeContext = geocode_context)
  if (!is.null(centroid_context)) input$countryCentroidContext <- centroid_context
  if (!is.null(hdp_context)) input$hdpFacetContext <- hdp_context

  initial <- .request_record_triage(
    apiKey = apiKey,
    model = "gpt-4.1-mini",
    instructions = .record_triage_prompt,
    input = input,
    maxOutputTokens = 400
  )
  advanced <- NULL
  if (initial$decision == "NEEDS_REVIEW") {
    advanced_input <- list(
      occurrenceKey = occurrenceKey,
      record = record,
      geocodeContext = geocode_context,
      countryCentroidContext = centroid_context,
      initialAssessment = initial
    )
    if (!is.null(hdp_context)) advanced_input$hdpFacetContext <- hdp_context
    advanced <- .request_record_triage(
      apiKey = apiKey,
      model = "gpt-5.6-terra",
      instructions = .advanced_record_triage_prompt,
      input = advanced_input,
      maxOutputTokens = 4000,
      reasoningEffort = "high"
    )
  }

  output <- list(
    occurrenceKey = occurrence_key,
    record = record,
    geocodeContext = geocode_context,
    initialAssessment = initial,
    advancedAssessment = advanced,
    finalAssessment = if (is.null(advanced)) initial else advanced
  )
  if (!is.null(hdp_context)) output$hdpFacetContext <- hdp_context
  output
}

.record_geocode_context <- function(record) {
  latitude <- record$decimalLatitude
  longitude <- record$decimalLongitude
  valid <- function(value, limit) {
    is.numeric(value) && length(value) == 1 && is.finite(value) && abs(value) <= limit
  }
  context <- list(
    source = "rgbif::gbif_geocode (experimental GBIF reverse geocoder)",
    status = "missing_or_invalid_coordinates",
    latitude = latitude, longitude = longitude,
    results = data.frame()
  )
  if (!valid(latitude, 90) || !valid(longitude, 180)) return(context)
  results <- tryCatch(
    rgbif::gbif_geocode(latitude = latitude, longitude = longitude),
    error = function(error) {
      stop("GBIF reverse geocode failed for (", latitude, ", ", longitude, "): ",
           conditionMessage(error), call. = FALSE)
    }
  )
  if (!is.data.frame(results)) {
    stop("GBIF reverse geocode returned invalid results.", call. = FALSE)
  }
  context$results <- as.data.frame(results)
  has_polygons <- nrow(results) > 0 && all(c("type", "title") %in% names(results)) &&
    any(!is.na(results$type) & nzchar(as.character(results$type)) &
        !is.na(results$title) & nzchar(as.character(results$title)))
  if (nrow(results) > 0 && !all(c("type", "title") %in% names(results))) {
    # rgbif may return only the input coordinates when there are no matches.
    if (!all(c("latitude", "longitude", "index") %in% names(results)) ||
        any(!names(results) %in% c("latitude", "longitude", "index"))) {
      stop("GBIF reverse geocode returned invalid polygon fields.", call. = FALSE)
    }
  }
  context$status <- if (has_polygons) "matched" else "no_polygon_matches"
  context
}

.hdp_facet_context <- function(candidates) {
  if (!is.list(candidates) || length(candidates$taxonKey) != 1 ||
      is.na(candidates$taxonKey) || !nzchar(as.character(candidates$taxonKey)) ||
      !is.character(candidates$hdp) || length(candidates$hdp) != 1 ||
      is.na(candidates$hdp) || !"basisOfRecord" %in% names(candidates)) {
    stop("candidates must be an out_cand() result with taxonKey, hdp and basisOfRecord; ",
         "rerun out_cand() for older saved results.")
  }
  basis <- candidates$basisOfRecord
  if (!is.null(basis) &&
      (!is.character(basis) || !length(basis) || anyNA(basis) ||
       any(!nzchar(trimws(basis))) || any(grepl(";", basis, fixed = TRUE)))) {
    stop("candidates$basisOfRecord must be NULL or non-empty individual channels.")
  }
  geometry <- sf::st_as_sfc(candidates$hdp, crs = 4326)
  if (any(!as.character(sf::st_geometry_type(geometry)) %in% c("POLYGON", "MULTIPOLYGON")) ||
      any(!sf::st_is_valid(geometry))) {
    stop("candidates$hdp must be valid polygon WKT.")
  }
  basis_filter <- if (is.null(basis)) NULL else paste(unique(trimws(basis)), collapse = ";")
  counts <- lapply(c("country", "continent"), function(facet) {
    if (all(sf::st_is_empty(geometry))) {
      data <- data.frame(value = character(), count = numeric())
      names(data)[1] <- facet
      return(data)
    }
    data <- if (!is.null(candidates$hdpFacets)) {
      candidates$hdpFacets[[facet]]
    } else tryCatch(
      occ_count(
        taxonKey = candidates$taxonKey, geometry = candidates$hdp,
        basisOfRecord = basis_filter, occurrenceStatus = "PRESENT",
        facet = facet, facetLimit = 300
      ),
      error = function(error) {
        stop("HDP ", facet, " facet query failed: ", conditionMessage(error),
             call. = FALSE)
      }
    )
    if (!is.data.frame(data) || !all(c(facet, "count") %in% names(data)) ||
        !is.character(data[[facet]]) || anyNA(data[[facet]]) ||
        any(!nzchar(data[[facet]])) || anyDuplicated(data[[facet]]) ||
        !is.numeric(data$count) || any(!is.finite(data$count)) ||
        any(data$count < 0 | data$count != floor(data$count))) {
      stop("Invalid HDP ", facet, " facet response.", call. = FALSE)
    }
    data[, c(facet, "count"), drop = FALSE]
  })
  list(taxonKey = as.character(candidates$taxonKey), basisOfRecord = basis,
       scope = "PRESENT GBIF occurrences within the combined HDP polygons",
       country = counts[[1]], continent = counts[[2]])
}

.record_triage_decisions <- c("SUSPICIOUS", "INTRODUCED", "OK", "FORMER", "NEEDS_REVIEW")

.record_triage_reasons <- c(
  "captive_or_managed",
  "locality_coordinate_mismatch",
  "unlikely_location_for_taxon",
  "country_centroid_anomaly",
  "dataset_quality_concern",
  "taxonomic_or_identification_mismatch",
  "introduced_population",
  "fossil_or_subfossil",
  "high_coordinate_uncertainty",
  "other",
  "insufficient_information",
  "none"
)

.record_triage_schema <- list(
  type = "object",
  properties = list(
    decision = list(type = "string", enum = .record_triage_decisions),
    reason_category = list(type = "string", enum = .record_triage_reasons),
    explanation = list(type = "string")
  ),
  required = c("decision", "reason_category", "explanation"),
  additionalProperties = FALSE
)

.fossil_review_policy <- paste(
  "Before any native-range review, check whether the record is a fossil or",
  "subfossil, even when basisOfRecord is PRESERVED_SPECIMEN or another value.",
  "Evidence includes geological context or age fields, formation or stratigraphic",
  "terms, a paleontological collection or dataset, fossil wording in locality,",
  "remarks, or dynamicProperties, or basisOfRecord FOSSIL_SPECIMEN. Return FORMER",
  "with reason fossil_or_subfossil; never SUSPICIOUS or OK for such a record, and",
  "do not apply the native-range comparison to it. An old collection date alone is",
  "not fossil evidence. Use NEEDS_REVIEW when fossil status is only suggestive.",
  sep = " "
)

.coordinate_uncertainty_policy <- paste(
  "After the fossil check, if coordinateUncertaintyInMeters is 500,000 or more",
  "(500 km), return SUSPICIOUS with reason high_coordinate_uncertainty, regardless",
  "of the native range and without any native-range comparison. Use",
  "country_centroid_anomaly instead when its own conditions are met. A missing or",
  "smaller uncertainty value does not trigger this rule.",
  sep = " "
)

.coordinate_location_review_policy <- paste(
  "After the fossil and coordinate-uncertainty checks, establish the plotted",
  "location from decimalLatitude and decimalLongitude before reviewing range.",
  "Treat locality, stateProvince, country, countryCode, verbatim locality, and",
  "verbatim coordinates as claims to cross-check, not proof of where the plotted",
  "point lies. Never substitute a named locality for the supplied coordinates",
  "or silently repair, swap, or negate coordinates to make the record plausible.",
  "Compare the coordinate location with those geographic claims, accounting for",
  "coordinate uncertainty; do not invent a reverse-geocoded location or claim",
  "a precise administrative-boundary check that has not been supplied.",
  "A clear coordinate/locality contradiction is SUSPICIOUS with reason",
  "locality_coordinate_mismatch even if the named locality is in the native range.",
  "If the coordinate location or the significance of a possible conflict cannot",
  "be established confidently, use NEEDS_REVIEW rather than OK.",
  "Missing or invalid coordinates cannot support a coordinate-based OK decision.",
  "Unresolved coordinate or locality conflicts must not be dismissed as",
  "'some coordinate and data issues' in an otherwise OK assessment.",
  "Neither HDP country/continent facets nor country-centroid distance verify",
  "that this individual point lies in its stated province, country, or locality.",
  "Use geocodeContext.results as external polygon evidence for the supplied",
  "coordinates: GADM0 identifies country-level areas and GADM1 province/state",
  "areas; other polygon types may describe marine or botanical regions, not",
  "administrative provinces. Compare returned titles with the record's claims",
  "instead of asserting that the coordinates lie in the named locality.",
  "Geocoder matches describe the point, not its entire uncertainty radius;",
  "account for coordinate uncertainty near boundaries. Do not assume the units",
  "of a returned distance field or compare it numerically with uncertainty",
  "unless its units and meaning are established. The geocoder is experimental,",
  "not infallible. A matched status does not guarantee GADM0 or GADM1 coverage.",
  "Missing polygon levels, no_polygon_matches, or missing_or_invalid_coordinates",
  "mean unknown coverage, not confirmation of the claimed locality or a mismatch.",
  "For a geographic decision, state the supplied latitude and longitude and",
  "explain the specific mismatch, range comparison, or unresolved uncertainty.",
  sep = " "
)

.native_range_review_policy <- paste(
  "First identify the focal accepted taxon using acceptedScientificName or",
  "scientificName, taxonRank, and classification. Recall its native range from",
  "your pretrained biogeographic knowledge: regions, countries, islands, and",
  "habitat where confidently known. Do not substitute a genus or family range",
  "for a species range or guess the distribution of an unfamiliar taxon.",
  "Then compare the plotted coordinate location, not merely the named locality,",
  "with that recalled range,",
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
  "Never use SUSPICIOUS for a range mismatch when the record is identified only",
  "to genus or a higher rank, when the name may reflect a recent taxonomic split,",
  "synonym, or unmatched name whose range may differ from the concept you recall,",
  "or when the location lies beyond a range edge known to be expanding naturally;",
  "use NEEDS_REVIEW instead. Natural range expansion is neither SUSPICIOUS nor",
  "INTRODUCED.",
  "Distinguish supplied record facts from model-recalled range knowledge: the latter",
  "is not externally verified. For a range-based decision, name the recalled range",
  "and contrast it with the record location in the one-sentence explanation.",
  "Do not invent record details, introduction evidence, or source citations.",
  sep = " "
)

.hdp_facet_review_policy <- paste(
  "When hdpFacetContext is supplied, use its country and continent occurrence",
  "counts as supporting context for the focal taxon's observed GBIF distribution",
  "within the HDP polygons (including count-excluded cells), not its native range.",
  "These counts may include introduced populations and data errors and are",
  "limited by polygon coverage and basis-of-record filters. An absent country",
  "or continent, or empty facets, is not evidence of absence or a reason by",
  "itself to mark a record SUSPICIOUS. Do not replace the native-range review",
  "with facet membership or override the fossil and uncertainty policies.",
  sep = " "
)

.record_triage_prompt <- paste(
  "Triage one GBIF occurrence record selected as a geographic outlier.",
  .fossil_review_policy,
  .coordinate_uncertainty_policy,
  .coordinate_location_review_policy,
  .native_range_review_policy,
  .hdp_facet_review_policy,
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
  "range policy above, or coordinate uncertainty of 500,000 metres or more.",
  "INTRODUCED means an otherwise plausible,",
  "free-ranging established introduced population. OK requires positive context",
  "supporting a plausible wild occurrence. NEEDS_REVIEW is the default for",
  "incomplete, ambiguous, conflicting, or unexplained outlier evidence.",
  "Use reason none only for OK, introduced_population for INTRODUCED, and",
  "fossil_or_subfossil only for FORMER, which means a fossil or subfossil record.",
  "Return one short sentence. Do not invent record facts or write data to GBIF.",
  sep = " "
)

.advanced_record_triage_prompt <- paste(
  "You are the advanced reviewer for an occurrence that the fast triage model",
  "marked NEEDS_REVIEW. Independently review the original GBIF record, country",
  "centroid context, and initial assessment. Do not defer to the initial model.",
  .fossil_review_policy,
  .coordinate_uncertainty_policy,
  .coordinate_location_review_policy,
  .native_range_review_policy,
  .hdp_facet_review_policy,
  "Independently reconsider the native range; do not treat the fast model's",
  "range description as verified evidence.",
  "Apply the same decision definitions: SUSPICIOUS for non-wild records or a",
  "concrete data error or a clear native-range mismatch under the policy above;",
  "or coordinate uncertainty of 500,000 metres or more; INTRODUCED for a plausible",
  "free-ranging established",
  "introduced population; OK only with positive context supporting a plausible",
  "wild record; FORMER for a fossil or subfossil record; NEEDS_REVIEW when",
  "evidence is incomplete or ambiguous.",
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
  decisions <- .record_triage_decisions
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