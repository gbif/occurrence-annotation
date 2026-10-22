test_that("reverse geocoder evidence is fetched once and sent unchanged to both reviewers", {
  record <- list(decimalLatitude = 55.6147, decimalLongitude = -122.267,
                 stateProvince = "Ontario", country = "Canada",
                 coordinateUncertaintyInMeters = 301)
  evidence <- data.frame(
    latitude = 55.6147, longitude = -122.267, index = 1,
    id = c("CAN", "CAN.2"), type = c("GADM0", "GADM1"),
    title = c("Canada", "British Columbia"), distance = c(100, 200)
  )
  calls <- 0
  inputs <- list()
  local_mocked_bindings(
    gbif_geocode = function(latitude, longitude) {
      calls <<- calls + 1
      expect_identical(latitude, record$decimalLatitude)
      expect_identical(longitude, record$decimalLongitude)
      evidence
    }, .package = "rgbif"
  )
  local_mocked_bindings(
    .fetch_occurrence_record = function(...) record,
    .country_centroid_context = function(...) NULL,
    .request_record_triage = function(input, instructions, model, ...) {
      inputs[[length(inputs) + 1]] <<- input
      expect_identical(input$record$stateProvince, "Ontario")
      expect_identical(input$geocodeContext$results, evidence)
      expect_match(instructions, "GADM1 province/state", fixed = TRUE)
      expect_match(instructions, "not its entire uncertainty radius", fixed = TRUE)
      list(decision = "NEEDS_REVIEW", model = model)
    }, .package = "gbifout"
  )
  result <- occ_agent(123, apiKey = "test-key")
  expect_equal(calls, 1)
  expect_length(inputs, 2)
  expect_identical(inputs[[1]]$geocodeContext, inputs[[2]]$geocodeContext)
  expect_identical(result$geocodeContext, inputs[[1]]$geocodeContext)
  expect_identical(result$geocodeContext$status, "matched")
})

test_that("invalid coordinates do not call the geocoder", {
  local_mocked_bindings(gbif_geocode = function(...) stop("must not geocode"),
                        .package = "rgbif")
  for (record in list(list(), list(decimalLatitude = NA_real_, decimalLongitude = 1),
                      list(decimalLatitude = 91, decimalLongitude = 1),
                      list(decimalLatitude = 1, decimalLongitude = -181),
                      list(decimalLatitude = "55", decimalLongitude = 1),
                      list(decimalLatitude = c(1, 2), decimalLongitude = 1),
                      list(decimalLatitude = Inf, decimalLongitude = 1))) {
    context <- gbifout:::.record_geocode_context(record)
    expect_identical(context$status, "missing_or_invalid_coordinates")
    expect_equal(nrow(context$results), 0)
  }
})

test_that("no coverage retains raw results without claiming a geographic match", {
  response <- data.frame()
  local_mocked_bindings(gbif_geocode = function(...) response, .package = "rgbif")
  record <- list(decimalLatitude = 0, decimalLongitude = 0)
  for (empty in list(data.frame(), data.frame(latitude = 0, longitude = 0, index = 1),
                     data.frame(type = NA_character_, title = NA_character_))) {
    response <- empty
    context <- gbifout:::.record_geocode_context(record)
    expect_identical(context$status, "no_polygon_matches")
    expect_identical(context$results, response)
  }
})

test_that("geocoder errors and malformed data stop before paid review", {
  local_mocked_bindings(gbif_geocode = function(...) stop("offline"), .package = "rgbif")
  local_mocked_bindings(
    .fetch_occurrence_record = function(...) list(decimalLatitude = 55.6147,
                                                 decimalLongitude = -122.267),
    .request_record_triage = function(...) stop("must not review"),
    .package = "gbifout"
  )
  expect_error(occ_agent(123, apiKey = "test-key"), "GBIF reverse geocode failed.*offline")
  response <- NULL
  local_mocked_bindings(gbif_geocode = function(...) response, .package = "rgbif")
  expect_error(occ_agent(123, apiKey = "test-key"), "invalid results")
  response <- data.frame(unexpected = "value")
  expect_error(occ_agent(123, apiKey = "test-key"), "invalid polygon fields")
})
