test_that("pipeline chains the three steps and returns final assessments", {
  calls <- character()
  wkts <- c("POLYGON ((0 0, 1 0, 1 1, 0 1, 0 0))",
            "POLYGON ((2 0, 3 0, 3 1, 2 1, 2 0))")
  hdp <- "MULTIPOLYGON (((4 0, 5 0, 5 1, 4 1, 4 0)))"
  polygons <- list(taxonKey = "3NFRS", candidates = data.frame(binWkt = wkts),
                    hdp = hdp, hdpCells = hdp, basisOfRecord = "HUMAN_OBSERVATION")
  facet_calls <- character()
  local_mocked_bindings(
    out_cand = function(taxonKey, basisOfRecord, ...) {
      calls <<- c(calls, "find")
      expect_identical(taxonKey, "3NFRS")
      expect_identical(basisOfRecord, "HUMAN_OBSERVATION")
      expect_equal(list(...)$maxOccurrenceCount, 10)
      polygons
    },
    occ_fetch_unique = function(result, basisOfRecord, sampleSize) {
      calls <<- c(calls, "fetch")
      expect_identical(result, polygons)
      expect_identical(basisOfRecord, "HUMAN_OBSERVATION")
      expect_equal(sampleSize, 2)
      data.frame(gbifid = c("5195998433", "6497435304"), binWkt = wkts)
    },
    occ_count = function(taxonKey, geometry, basisOfRecord, occurrenceStatus,
                         facet, facetLimit) {
      facet_calls <<- c(facet_calls, facet)
      expect_identical(taxonKey, "3NFRS")
      expect_identical(geometry, hdp)
      expect_identical(basisOfRecord, "HUMAN_OBSERVATION")
      expect_identical(occurrenceStatus, "PRESENT")
      expect_equal(facetLimit, 300)
      data <- data.frame(value = if (facet == "country") "DE" else "EUROPE", count = 20)
      names(data)[1] <- facet
      data
    },
    occ_agent = function(occurrenceKey, apiKey, candidates) {
      calls <<- c(calls, occurrenceKey)
      expect_identical(apiKey, "test-key")
      expect_identical(candidates$hdpFacets$country$country, "DE")
      expect_identical(candidates$hdpFacets$continent$continent, "EUROPE")
      list(
        initialAssessment = list(decision = "NEEDS_REVIEW"),
        finalAssessment = list(
          decision = if (occurrenceKey == "5195998433") "SUSPICIOUS" else "INTRODUCED",
          reasonCategory = "other", explanation = paste("Final", occurrenceKey),
          model = "advanced-model"
        )
      )
    },
    .package = "gbifout"
  )

  result <- pipeline("3NFRS", basisOfRecord = "HUMAN_OBSERVATION",
                     sampleSize = 2, apiKey = "test-key", maxOccurrenceCount = 10)
  expect_identical(calls, c("find", "fetch", "5195998433", "6497435304"))
  expect_identical(facet_calls, c("country", "continent"))
  expect_s3_class(result, "gbifout_pipeline")
  expect_identical(names(result), c("data", "sus", "int", "ok", "hdp", "taxonKey",
                                    "sdmPolygons"))
  expect_identical(result$taxonKey, "3NFRS")
  expect_identical(result$sdmPolygons, data.frame(group = "hdp", binWkt = hdp))
  expect_identical(result$hdp, hdp)
  expect_identical(result$ok, "MULTIPOLYGON EMPTY")
  expect_true(sf::st_equals(sf::st_as_sfc(result$sus), sf::st_as_sfc(wkts[1]),
                            sparse = FALSE)[1, 1])
  expect_true(sf::st_equals(sf::st_as_sfc(result$int), sf::st_as_sfc(wkts[2]),
                            sparse = FALSE)[1, 1])
  expect_identical(names(result$data), c("gbifid", "binWkt", "taxonKey", "decision",
                                   "reasonCategory", "explanation", "model"))
  expect_identical(result$data$gbifid, c("5195998433", "6497435304"))
  expect_identical(result$data$binWkt, wkts)
  expect_identical(result$data$taxonKey, rep("3NFRS", 2))
  expect_identical(result$data$decision, c("SUSPICIOUS", "INTRODUCED"))
  expect_identical(result$data$model, rep("advanced-model", 2))
})

test_that("empty fetches return a typed table without assessment calls", {
  expected_basis <- eval(formals(out_cand)$basisOfRecord)
  hdp <- "MULTIPOLYGON (((4 0, 5 0, 5 1, 4 1, 4 0)))"
  local_mocked_bindings(
    out_cand = function(...) list(taxonKey = 123, hdp = hdp, hdpCells = hdp),
    occ_fetch_unique = function(result, basisOfRecord, sampleSize) {
      expect_equal(sampleSize, 5)
      expect_identical(basisOfRecord, expected_basis)
      data.frame(gbifid = character(), binWkt = character())
    },
    occ_agent = function(...) stop("must not assess"),
    .package = "gbifout"
  )
  result <- pipeline(123, apiKey = "test-key")
  expect_s3_class(result, "gbifout_pipeline")
  expect_identical(names(result), c("data", "sus", "int", "ok", "hdp", "taxonKey",
                                    "sdmPolygons"))
  expect_identical(result$taxonKey, "123")
  expect_identical(result$sdmPolygons, data.frame(group = "hdp", binWkt = hdp))
  expect_identical(result$hdp, hdp)
  expect_equal(nrow(result$data), 0)
  expect_true(all(vapply(result$data, is.character, logical(1))))
  expect_identical(unname(unlist(result[c("sus", "int", "ok")])),
                   rep("MULTIPOLYGON EMPTY", 3))
})

test_that("decision multipolygons combine unique cells and allow mixed decisions", {
  wkts <- c("POLYGON ((0 0, 1 0, 1 1, 0 1, 0 0))",
            "POLYGON ((2 0, 3 0, 3 1, 2 1, 2 0))")
  decisions <- c("SUSPICIOUS", "SUSPICIOUS", "SUSPICIOUS", "OK", "NEEDS_REVIEW")
  local_mocked_bindings(
    out_cand = function(...) list(taxonKey = 123, hdp = "MULTIPOLYGON EMPTY",
                                  basisOfRecord = NULL),
    occ_fetch_unique = function(...) data.frame(
      gbifid = as.character(seq_along(decisions)), binWkt = wkts[c(1, 1, 2, 1, 2)]
    ),
    occ_agent = function(occurrenceKey, ...) list(finalAssessment = list(
      decision = decisions[as.integer(occurrenceKey)], reasonCategory = "other",
      explanation = "Assessment", model = "test-model"
    )),
    .package = "gbifout"
  )
  result <- pipeline(123, apiKey = "test-key")
  expect_equal(nrow(result$data), 5)
  expect_identical(result$hdp, "MULTIPOLYGON EMPTY")
  expect_identical(result$int, "MULTIPOLYGON EMPTY")
  expect_identical(result$sdmPolygons, data.frame(group = "ok", binWkt = wkts[1]))
  expect_true(all(vapply(result[c("sus", "int", "ok")], function(wkt) {
    length(wkt) == 1 && startsWith(wkt, "MULTIPOLYGON")
  }, logical(1))))
  expected <- sf::st_union(sf::st_as_sfc(wkts))
  expect_true(sf::st_equals(sf::st_as_sfc(result$sus), expected, sparse = FALSE)[1, 1])
  expect_true(sf::st_equals(sf::st_as_sfc(result$ok), sf::st_as_sfc(wkts[1]),
                            sparse = FALSE)[1, 1])
})

test_that("pipeline errors identify the occurrence and invalid inputs stop early", {
  local_mocked_bindings(
    out_cand = function(...) list(taxonKey = "taxon", hdp = "MULTIPOLYGON EMPTY",
                                  basisOfRecord = NULL),
    occ_fetch_unique = function(...) data.frame(gbifid = "123", binWkt = "polygon"),
    occ_agent = function(...) stop("model unavailable"),
    .package = "gbifout"
  )
  expect_error(pipeline("taxon", apiKey = "test-key"), "GBIF ID 123: model unavailable")
  expect_error(pipeline(NA, apiKey = "test-key"), "taxonKey")
  expect_error(pipeline("taxon", apiKey = ""), "OPENAI_API_KEY")
  expect_error(pipeline("taxon", apiKey = "test-key", sampleSize = 0), "sampleSize")
})