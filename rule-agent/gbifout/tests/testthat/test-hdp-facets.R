hdp_facet_fixture <- function() {
  list(taxonKey = "DJX8", basisOfRecord = c(" HUMAN_OBSERVATION ", "OBSERVATION"),
       hdp = "MULTIPOLYGON (((0 0, 1 0, 1 1, 0 1, 0 0)),
                            ((2 0, 3 0, 3 1, 2 1, 2 0)))")
}

test_that("HDP facets use the combined area, taxon and original channels", {
  candidates <- hdp_facet_fixture()
  calls <- character()
  local_mocked_bindings(
    occ_count = function(taxonKey, geometry, basisOfRecord, occurrenceStatus,
                         facet, facetLimit) {
      calls <<- c(calls, facet)
      expect_identical(taxonKey, candidates$taxonKey)
      expect_true(sf::st_equals(
        sf::st_as_sfc(geometry, crs = 4326),
        sf::st_as_sfc(candidates$hdp, crs = 4326),
        sparse = FALSE
      )[1, 1])
      expect_identical(basisOfRecord, "HUMAN_OBSERVATION;OBSERVATION")
      expect_identical(occurrenceStatus, "PRESENT")
      expect_equal(facetLimit, 300)
      if (facet == "country") data.frame(country = c("DE", "FR"), count = c(10, 20))
      else data.frame(continent = "EUROPE", count = 30)
    }, .package = "gbifout"
  )
  context <- gbifout:::.hdp_facet_context(candidates)
  expect_identical(calls, c("country", "continent"))
  expect_equal(context$country$count, c(10, 20))
  expect_equal(context$continent$count, 30)
  expect_identical(context$taxonKey, "DJX8")
  expect_false(identical(candidates$hdp, gbifout:::.orient_rings(
    sf::st_as_sfc(candidates$hdp, crs = 4326)
  )))

  candidates$hdpFacets <- context
  expect_identical(gbifout:::.hdp_facet_context(candidates), context)
  expect_length(calls, 2)
})

test_that("HDP facet requests orient exterior rings counter-clockwise and holes clockwise", {
  candidates <- hdp_facet_fixture()
  candidates$hdp <- paste(
    "POLYGON ((0 0, 0 4, 4 4, 4 0, 0 0),",
    "(1 1, 3 1, 3 3, 1 3, 1 1))"
  )
  requested <- character()
  ring_area <- function(ring) {
    sum(ring[-nrow(ring), 1] * ring[-1, 2] -
          ring[-1, 1] * ring[-nrow(ring), 2]) / 2
  }
  local_mocked_bindings(
    occ_count = function(geometry, facet, ...) {
      requested <<- c(requested, geometry)
      parsed <- sf::st_cast(sf::st_as_sfc(geometry, crs = 4326), "POLYGON")[[1]]
      expect_gt(ring_area(parsed[[1]]), 0)
      expect_lt(ring_area(parsed[[2]]), 0)
      if (facet == "country") data.frame(country = character(), count = numeric())
      else data.frame(continent = character(), count = numeric())
    }, .package = "gbifout"
  )
  gbifout:::.hdp_facet_context(candidates)
  expect_length(requested, 2)
  expect_true(all(requested == requested[[1]]))
  expect_false(identical(requested[[1]], candidates$hdp))
  expect_true(sf::st_equals(sf::st_as_sfc(requested[[1]], crs = 4326),
                            sf::st_as_sfc(candidates$hdp, crs = 4326),
                            sparse = FALSE)[1, 1])
})

test_that("both assessment models receive identical HDP context", {
  candidates <- hdp_facet_fixture()
  inputs <- list()
  local_mocked_bindings(
    occ_count = function(facet, ...) {
      if (facet == "country") data.frame(country = "DE", count = 5)
      else data.frame(continent = "EUROPE", count = 5)
    },
    .fetch_occurrence_record = function(...) list(key = "123"),
    .country_centroid_context = function(...) NULL,
    .request_record_triage = function(input, instructions, model, ...) {
      inputs[[length(inputs) + 1]] <<- input
      expect_match(instructions, "not its native range", fixed = TRUE)
      expect_match(instructions, "is not evidence of absence", fixed = TRUE)
      list(decision = if (length(inputs) == 1) "NEEDS_REVIEW" else "OK",
           reasonCategory = "none", explanation = "Review", model = model)
    }, .package = "gbifout"
  )
  result <- occ_agent(123, apiKey = "test-key", candidates = candidates)
  expect_length(inputs, 2)
  expect_identical(inputs[[1]]$hdpFacetContext, inputs[[2]]$hdpFacetContext)
  expect_identical(result$hdpFacetContext, inputs[[1]]$hdpFacetContext)
  expect_identical(result$hdpFacetContext$country$country, "DE")
  expect_identical(inputs[[2]]$initialAssessment, result$initialAssessment)
})

test_that("empty HDP areas make no facet requests and all-channel queries stay unfiltered", {
  candidates <- hdp_facet_fixture()
  candidates$hdp <- "MULTIPOLYGON EMPTY"
  local_mocked_bindings(occ_count = function(...) stop("must not query"),
                        .package = "gbifout")
  context <- gbifout:::.hdp_facet_context(candidates)
  expect_identical(context$country, data.frame(country = character(), count = numeric()))
  expect_identical(context$continent, data.frame(continent = character(), count = numeric()))

  candidates <- hdp_facet_fixture()
  candidates["basisOfRecord"] <- list(NULL)
  local_mocked_bindings(occ_count = function(basisOfRecord, facet, ...) {
    expect_null(basisOfRecord)
    if (facet == "country") data.frame(country = character(), count = numeric())
    else data.frame(continent = character(), count = numeric())
  }, .package = "gbifout")
  expect_equal(nrow(gbifout:::.hdp_facet_context(candidates)$country), 0)
})

test_that("facet failures, malformed responses and legacy inputs are explicit", {
  candidates <- hdp_facet_fixture()
  local_mocked_bindings(occ_count = function(...) stop("offline"),
                        .package = "gbifout")
  expect_error(gbifout:::.hdp_facet_context(candidates), "HDP country facet query failed: offline")
  local_mocked_bindings(occ_count = function(...) data.frame(country = "DE", count = NA_real_),
                        .package = "gbifout")
  expect_error(gbifout:::.hdp_facet_context(candidates), "Invalid HDP country facet response")
  candidates$hdpFacets <- list(country = data.frame(country = "DE", count = -1))
  expect_error(gbifout:::.hdp_facet_context(candidates), "Invalid HDP country facet response")
  candidates$basisOfRecord <- NULL
  expect_error(gbifout:::.hdp_facet_context(candidates), "rerun out_cand", fixed = TRUE)
  candidates <- hdp_facet_fixture()
  candidates$hdp <- "POINT (0 0)"
  expect_error(gbifout:::.hdp_facet_context(candidates), "valid polygon WKT")
  candidates <- hdp_facet_fixture()
  candidates$basisOfRecord <- NA_character_
  expect_error(gbifout:::.hdp_facet_context(candidates), "individual channels")
})

test_that("continent query failures stop before fetching or paying for record assessment", {
  candidates <- hdp_facet_fixture()
  local_mocked_bindings(
    occ_count = function(facet, ...) {
      if (facet == "country") return(data.frame(country = "DE", count = 5))
      stop("continent offline")
    },
    .fetch_occurrence_record = function(...) stop("must not fetch record"),
    .request_record_triage = function(...) stop("must not assess"),
    .package = "gbifout"
  )
  expect_error(occ_agent(123, apiKey = "test-key", candidates = candidates),
               "HDP continent facet query failed: continent offline", fixed = TRUE)
})
