test_that("a decisive fast assessment is returned without advanced escalation", {
  requests <- list()
  local_mocked_bindings(
    .fetch_occurrence_record = function(key) {
      expect_equal(key, 123)
      list(key = "123", countryCode = "DE")
    },
    .country_centroid_context = function(record) {
      expect_equal(record[["countryCode"]], "DE")
      list(countryCode = "DE", distanceFromCentroidKm = 30)
    },
    .request_record_triage = function(apiKey, model, instructions, input,
                                      maxOutputTokens, reasoningEffort = NULL) {
      requests[[length(requests) + 1]] <<- list(
        model = model,
        input = input,
        reasoningEffort = reasoningEffort
      )
      list(
        decision = "SUSPICIOUS",
        reasonCategory = "captive_or_managed",
        explanation = "The record says the animal was held in a zoo.",
        model = model
      )
    },
    .package = "gbifout"
  )

  result <- assess_occurrence_record(123, apiKey = "test-key")

  expect_equal(result$initialAssessment$decision, "SUSPICIOUS")
  expect_null(result$advancedAssessment)
  expect_identical(result$finalAssessment, result$initialAssessment)
  expect_length(requests, 1)
  expect_equal(requests[[1]]$model, "gpt-4.1-mini")
})

test_that("NEEDS_REVIEW escalates and preserves both assessments", {
  models <- character()
  prompts <- character()
  decisions <- c("NEEDS_REVIEW", "INTRODUCED")
  local_mocked_bindings(
    .fetch_occurrence_record = function(key) list(key = as.character(key)),
    .country_centroid_context = function(record) NULL,
    .request_record_triage = function(apiKey, model, instructions, input,
                                      maxOutputTokens, reasoningEffort = NULL) {
      models <<- c(models, model)
      prompts <<- c(prompts, instructions)
      list(
        decision = decisions[[length(models)]],
        reasonCategory = if (length(models) == 1) "insufficient_information" else "introduced_population",
        explanation = paste("Assessment from", model),
        model = model
      )
    },
    .package = "gbifout"
  )

  result <- assess_occurrence_record(456, apiKey = "test-key")

  expect_equal(models, c("gpt-4.1-mini", "gpt-5.6-terra"))
  expect_equal(result$initialAssessment$decision, "NEEDS_REVIEW")
  expect_equal(result$advancedAssessment$decision, "INTRODUCED")
  expect_identical(result$finalAssessment, result$advancedAssessment)
  for (prompt in prompts) {
    expect_match(prompt, "First identify the focal accepted taxon", fixed = TRUE)
    expect_match(prompt, "pretrained biogeographic knowledge", fixed = TRUE)
    expect_match(prompt, "unlikely_location_for_taxon", fixed = TRUE)
    expect_match(prompt, "Retain INTRODUCED", fixed = TRUE)
    expect_match(prompt, "Use NEEDS_REVIEW when native-range knowledge", fixed = TRUE)
    expect_match(prompt, "allowing for coordinate uncertainty", fixed = TRUE)
    expect_match(prompt, "not externally verified", fixed = TRUE)
    expect_match(prompt, "identified only to genus", fixed = TRUE)
    expect_match(prompt, "recent taxonomic split", fixed = TRUE)
    expect_match(prompt, "expanding naturally", fixed = TRUE)
    expect_match(prompt, "Natural range expansion is neither SUSPICIOUS nor", fixed = TRUE)
    expect_false(grepl("Use only the supplied", prompt, fixed = TRUE))
    expect_match(prompt, "Before any native-range review, check whether the record is a fossil", fixed = TRUE)
    expect_match(prompt, "even when basisOfRecord is PRESERVED_SPECIMEN", fixed = TRUE)
    expect_match(prompt, "Return FORMER with reason fossil_or_subfossil", fixed = TRUE)
    expect_match(prompt, "never SUSPICIOUS or OK for such a record", fixed = TRUE)
    expect_match(prompt, "An old collection date alone is not fossil evidence", fixed = TRUE)
    expect_match(prompt, "After the fossil check, if coordinateUncertaintyInMeters is 500,000 or more", fixed = TRUE)
    expect_match(prompt, "return SUSPICIOUS with reason high_coordinate_uncertainty", fixed = TRUE)
    expect_match(prompt, "A missing or smaller uncertainty value does not trigger this rule", fixed = TRUE)
    expect_match(prompt, "or coordinate uncertainty of 500,000 metres or more", fixed = TRUE)
    expect_lt(regexpr("fossil or", prompt, fixed = TRUE)[[1]],
              regexpr("After the fossil check", prompt, fixed = TRUE)[[1]])
    expect_lt(regexpr("After the fossil check", prompt, fixed = TRUE)[[1]],
              regexpr("First identify the focal accepted taxon", prompt, fixed = TRUE)[[1]])
  }
  expect_match(prompts[[1]], "which means a fossil or subfossil record", fixed = TRUE)
  expect_match(prompts[[2]], "FORMER for a fossil or subfossil record", fixed = TRUE)
  expect_match(prompts[[2]], "do not treat the fast model's", fixed = TRUE)
})

test_that("FORMER is a valid decision in the schema and parser and stays final", {
  schema <- gbifout:::.record_triage_schema$properties
  expect_true("FORMER" %in% schema$decision$enum)
  expect_true("fossil_or_subfossil" %in% schema$reason_category$enum)
  expect_true("high_coordinate_uncertainty" %in% schema$reason_category$enum)

  parsed <- gbifout:::.parse_record_triage(
    '{"decision":"FORMER","reason_category":"fossil_or_subfossil","explanation":" Fossil from a formation. "}'
  )
  expect_identical(parsed, list(decision = "FORMER", reasonCategory = "fossil_or_subfossil",
                                explanation = "Fossil from a formation."))
  expect_error(gbifout:::.parse_record_triage(
    '{"decision":"EXTINCT","reason_category":"other","explanation":"x"}'
  ), "invalid")

  models <- character()
  local_mocked_bindings(
    .fetch_occurrence_record = function(key) list(key = as.character(key), basisOfRecord = "PRESERVED_SPECIMEN"),
    .country_centroid_context = function(record) NULL,
    .request_record_triage = function(apiKey, model, instructions, input,
                                      maxOutputTokens, reasoningEffort = NULL) {
      models <<- c(models, model)
      list(decision = "FORMER", reasonCategory = "fossil_or_subfossil",
           explanation = "Fossil.", model = model)
    },
    .package = "gbifout"
  )
  result <- assess_occurrence_record(789, apiKey = "test-key")
  expect_equal(models, "gpt-4.1-mini")
  expect_null(result$advancedAssessment)
  expect_equal(result$finalAssessment$decision, "FORMER")
})

test_that("invalid occurrence keys are rejected before API access", {
  expect_error(assess_occurrence_record("not-a-key", apiKey = "test-key"),
               "positive integer key")
})

test_that("empty output text is reported as a response issue, not a vapply error", {
  expect_error(
    gbifout:::.record_response_text(list(
      status = "completed",
      output = list(list(type = "message", content = list(list(type = "output_text"))))
    )),
    "no non-empty output_text"
  )
})

test_that("refusal output is reported distinctly", {
  expect_error(
    gbifout:::.record_response_text(list(
      status = "completed",
      output = list(list(type = "message", content = list(list(type = "refusal", refusal = "refused"))))
    )),
    "declined the structured triage response"
  )
})

test_that("country centroid context is derived from packaged country data", {
  context <- gbifout:::.country_centroid_context(list(
    countryCode = "DE",
    decimalLongitude = 13.360662,
    decimalLatitude = 52.406609
  ))

  expect_equal(context$countryCode, "DE")
  expect_true(context$distanceFromCentroidKm > 0)
  expect_match(context$note, "supporting context only")
})