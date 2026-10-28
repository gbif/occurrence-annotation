test_that("species profile resolves the exact taxon and makes one strong-model request", {
  expected <- species_context_fixture("DJX8")
  taxon_calls <- 0
  model_calls <- 0
  local_mocked_bindings(
    name_backbone = function(usageKey, strict) {
      taxon_calls <<- taxon_calls + 1
      expect_identical(usageKey, "DJX8")
      expect_true(strict)
      as.data.frame(expected$taxon)
    }, .package = "rgbif"
  )
  local_mocked_bindings(
    .request_structured_response = function(apiKey, model, instructions, input,
                                            maxOutputTokens, reasoningEffort,
                                            schema, schemaName) {
      model_calls <<- model_calls + 1
      expect_identical(model, "custom-model")
      expect_identical(apiKey, "test-key")
      expect_identical(input$taxon$scientificName, "Calopteryx maculata")
      expect_identical(input$taxonKey, "DJX8")
      expect_identical(reasoningEffort, "high")
      expect_equal(maxOutputTokens, 4000)
      expect_identical(schema, gbifout:::.species_context_schema)
      expect_identical(schemaName, "species_distribution")
      expect_match(instructions, "no external sources have been retrieved", fixed = TRUE)
      expect_match(instructions, "Do not invent citations", fixed = TRUE)
      expect_match(instructions, "Write 'Unknown'", fixed = TRUE)
      jsonlite::toJSON(expected$distribution, auto_unbox = TRUE)
    }, .package = "gbifout"
  )
  profile <- species_context("DJX8", model = "custom-model", apiKey = "test-key")
  expect_equal(taxon_calls, 1)
  expect_equal(model_calls, 1)
  expect_identical(profile$distribution, expected$distribution)
  expect_identical(profile$evidenceBasis, "model_knowledge_unverified")
  expect_identical(profile$sources, character())
  expect_identical(profile$model, "custom-model")
  path <- withr::local_tempfile(fileext = ".rds")
  saveRDS(profile, path)
  expect_identical(readRDS(path), profile)
})

test_that("taxonomic failures and malformed model profiles stop explicitly", {
  response <- data.frame(usageKey = "different", scientificName = "Wrong taxon", rank = "SPECIES")
  local_mocked_bindings(name_backbone = function(...) response, .package = "rgbif")
  local_mocked_bindings(.request_structured_response = function(...) stop("must not call"),
                        .package = "gbifout")
  expect_error(species_context("DJX8", apiKey = "test"), "resolve.*exactly")
  response <- data.frame(usageKey = "DJX8", scientificName = "Calopteryx maculata", rank = "SPECIES")
  local_mocked_bindings(.request_structured_response = function(...) '{"nativeRange":"Unknown"}',
                        .package = "gbifout")
  expect_error(species_context("DJX8", apiKey = "test"), "introducedRange")
  for (value in list(NULL, NA, "", c("a", "b"))) {
    expect_error(species_context(value, apiKey = "test"), "taxonKey")
  }
  expect_error(species_context("DJX8", model = "", apiKey = "test"), "model")
})

test_that("profile validation rejects mismatched taxa, invalid provenance and missing claims", {
  profile <- species_context_fixture()
  expect_error(gbifout:::.validate_species_context(profile, "other"), "requested taxonKey")
  profile$taxon$usageKey <- "other"
  expect_error(gbifout:::.validate_species_context(profile), "resolved taxon")
  profile <- species_context_fixture()
  profile$evidenceBasis <- "verified_by_model"
  expect_error(gbifout:::.validate_species_context(profile), "evidenceBasis")
  profile <- species_context_fixture()
  profile$distribution$knowledgeGaps <- ""
  expect_error(gbifout:::.validate_species_context(profile), "knowledgeGaps")
  profile <- species_context_fixture()
  profile$distribution$confidence <- "certain"
  expect_error(gbifout:::.validate_species_context(profile), "confidence")
})

test_that("shared profile reaches both reviewers without changing geocoder evidence", {
  profile <- species_context_fixture("DJX8")
  profile$taxon$acceptedUsageKey <- "accepted-key"
  inputs <- list()
  local_mocked_bindings(
    .fetch_occurrence_record = function(...) list(
      taxonKey = "DJX8", acceptedTaxonKey = "accepted-key",
      scientificName = "Calopteryx maculata"
    ),
    .country_centroid_context = function(...) NULL,
    .request_record_triage = function(input, instructions, model, ...) {
      inputs[[length(inputs) + 1]] <<- input
      expect_identical(input$speciesContext, profile)
      expect_match(instructions, "starting reference", fixed = TRUE)
      expect_match(instructions, "Neither is infallible", fixed = TRUE)
      expect_match(instructions, "use NEEDS_REVIEW", fixed = TRUE)
      list(decision = "NEEDS_REVIEW", model = model)
    }, .package = "gbifout"
  )
  result <- occ_agent(123, apiKey = "test", speciesContext = profile)
  expect_length(inputs, 2)
  expect_identical(inputs[[1]]$geocodeContext, inputs[[2]]$geocodeContext)
  expect_identical(result$speciesContext, profile)
  local_mocked_bindings(.fetch_occurrence_record = function(...) list(taxonKey = "wrong"),
                        .package = "gbifout")
  expect_error(occ_agent(123, apiKey = "test", speciesContext = profile), "taxon does not match")
})

test_that("taxonomic containment allows descendants but never matches missing keys", {
  profile <- species_context_fixture("genus-key")
  profile$taxon$rank <- "GENUS"
  profile$taxon$acceptedUsageKey <- NA_character_
  record <- list(taxonKey = "species-key", genusKey = "genus-key",
                 acceptedTaxonKey = NA_character_)
  local_mocked_bindings(
    .fetch_occurrence_record = function(...) record,
    .country_centroid_context = function(...) NULL,
    .request_record_triage = function(...) list(decision = "OK"),
    .package = "gbifout"
  )
  expect_identical(occ_agent(123, apiKey = "test", speciesContext = profile)$speciesContext,
                   profile)
  record$genusKey <- "different-genus"
  expect_error(occ_agent(123, apiKey = "test", speciesContext = profile), "taxon does not match")
})

test_that("reviewed profiles bypass generation and persist in pipeline results", {
  profile <- species_context_fixture("DJX8")
  profile$evidenceBasis <- "user_reviewed"
  profile$sources <- "Reviewer-supplied regional atlas"
  local_mocked_bindings(
    out_cand = function(...) list(taxonKey = "DJX8", hdp = "MULTIPOLYGON EMPTY",
                                  basisOfRecord = NULL),
    occ_fetch_unique = function(...) data.frame(
      gbifid = c("1", "2"), binWkt = "POLYGON ((0 0, 1 0, 1 1, 0 0))"
    ),
    species_context = function(...) stop("must not generate"),
    occ_agent = function(speciesContext, ...) {
      expect_identical(speciesContext, profile)
      list(finalAssessment = list(decision = "OK", reasonCategory = "none",
                                   explanation = "Test", model = "cheap-model"))
    }, .package = "gbifout"
  )
  result <- pipeline("DJX8", apiKey = "test", speciesContext = profile)
  expect_identical(result$speciesContext, profile)
  expect_equal(nrow(result$data), 2)
  path <- withr::local_tempfile(fileext = ".rds")
  saveRDS(result, path)
  expect_identical(readRDS(path)$speciesContext, profile)
  expect_error(pipeline("other", apiKey = "test", speciesContext = profile), "requested taxonKey")
})

test_that("profile request uses its schema and transport failures are not hidden", {
  profile <- species_context_fixture("DJX8")
  profile$taxon$acceptedUsageKey <- "accepted-key"
  profile$taxon$acceptedScientificName <- "Accepted species name"
  local_mocked_bindings(
    name_backbone = function(...) as.data.frame(profile$taxon), .package = "rgbif"
  )
  status <- "completed"
  local_mocked_bindings(
    req_perform = function(req, ...) {
      body <- req$body$data
      expect_identical(body$model, "gpt-5.6-terra")
      expect_identical(body$reasoning$effort, "high")
      expect_true(body$text$format$strict)
      expect_identical(body$text$format$name, "species_distribution")
      expect_identical(body$text$format$schema, gbifout:::.species_context_schema)
      input <- jsonlite::fromJSON(body$input)
      expect_identical(input$taxon$acceptedScientificName, "Accepted species name")
      structure(list(), class = "httr2_response")
    },
    resp_body_json = function(...) list(
      status = status,
      output = list(list(
        type = "message", content = list(list(
          type = "output_text",
          text = as.character(jsonlite::toJSON(profile$distribution, auto_unbox = TRUE))
        ))
      ))
    ), .package = "httr2"
  )
  result <- species_context("DJX8", apiKey = "test")
  expect_identical(result$taxon$acceptedUsageKey, "accepted-key")
  expect_identical(result$distribution, profile$distribution)
  status <- "incomplete"
  expect_error(species_context("DJX8", apiKey = "test"), "not completed")
  local_mocked_bindings(req_perform = function(...) stop("transport unavailable"),
                        .package = "httr2")
  expect_error(species_context("DJX8", apiKey = "test"), "transport unavailable")
})

test_that("profile generation failure prevents all per-record reviews", {
  local_mocked_bindings(
    out_cand = function(...) list(taxonKey = "DJX8", hdp = "MULTIPOLYGON EMPTY",
                                  basisOfRecord = NULL),
    occ_fetch_unique = function(...) data.frame(gbifid = "123", binWkt = "unused"),
    species_context = function(taxonKey, model, ...) {
      expect_identical(model, "custom-strong-model")
      stop("profile generation failed")
    },
    occ_agent = function(...) stop("must not assess"),
    .package = "gbifout"
  )
  expect_error(pipeline("DJX8", apiKey = "test", speciesModel = "custom-strong-model"),
               "profile generation failed")
})
