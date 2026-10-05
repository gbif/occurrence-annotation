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
    expect_false(grepl("Use only the supplied", prompt, fixed = TRUE))
  }
  expect_match(prompts[[2]], "do not treat the fast model's", fixed = TRUE)
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