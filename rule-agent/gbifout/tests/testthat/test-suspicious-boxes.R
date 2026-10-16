pipeline_result <- function(gbifids, decisions) {
  n <- length(gbifids)
  list(data = data.frame(
    gbifid = gbifids, binWkt = rep("cell", n), taxonKey = rep("taxon", n),
    decision = decisions, reasonCategory = rep("other", n),
    explanation = rep("text", n), model = rep("model", n),
    stringsAsFactors = FALSE
  ))
}

test_that("only SUSPICIOUS records are looked up and boxed", {
  lookups <- character()
  records <- list(
    "1" = list(decimalLatitude = 10, decimalLongitude = 20,
               datasetKey = "dataset-a", basisOfRecord = "PRESERVED_SPECIMEN"),
    "3" = list(decimalLatitude = 10.015, decimalLongitude = 20,
               datasetKey = "dataset-b", basisOfRecord = "HUMAN_OBSERVATION")
  )
  local_mocked_bindings(
    .fetch_occurrence_record = function(occurrenceKey) {
      # rgbif::occ_get() rejects character keys.
      stopifnot(is.numeric(occurrenceKey))
      lookups <<- c(lookups, as.character(occurrenceKey))
      records[[as.character(occurrenceKey)]]
    },
    .package = "gbifout"
  )
  result <- suspicious_boxes(pipeline_result(
    c("1", "2", "3", "4"), c("SUSPICIOUS", "OK", "SUSPICIOUS", "INTRODUCED")
  ))

  expect_identical(lookups, c("1", "3"))
  expect_identical(result$data$gbifid, c("1", "3"))
  expect_identical(result$data$datasetKey, c("dataset-a", "dataset-b"))
  expect_identical(result$data$basisOfRecord, c("PRESERVED_SPECIMEN", "HUMAN_OBSERVATION"))
  expect_equal(result$data$decimalLatitude, c(10, 10.015))
  expect_identical(result$data$explanation, c("text", "text"))
  bbox <- sf::st_bbox(sf::st_as_sfc(result$data$bboxWkt[1]))
  expect_equal(as.numeric(bbox), c(19.99, 9.99, 20.01, 10.01))
  expect_match(result$mp, "^MULTIPOLYGON")
  # The two boxes overlap, so they dissolve into one polygon.
  expected <- sf::st_union(sf::st_as_sfc(result$data$bboxWkt))
  expect_true(sf::st_equals(sf::st_as_sfc(result$mp), expected, sparse = FALSE)[1, 1])
})

test_that("boxes clamp at bounds and missing coordinates are excluded from mp", {
  records <- list(
    "1" = list(decimalLatitude = 89.5, decimalLongitude = 179.5,
               datasetKey = "d", basisOfRecord = "OCCURRENCE"),
    "2" = list(decimalLatitude = NA, decimalLongitude = 5)
  )
  local_mocked_bindings(
    .fetch_occurrence_record = function(occurrenceKey) records[[as.character(occurrenceKey)]],
    .package = "gbifout"
  )
  result <- suspicious_boxes(pipeline_result(c("1", "2"), rep("SUSPICIOUS", 2)),
                             halfWidth = 1)

  bbox <- sf::st_bbox(sf::st_as_sfc(result$data$bboxWkt[1]))
  expect_equal(as.numeric(bbox), c(178.5, 88.5, 180, 90))
  expect_true(is.na(result$data$bboxWkt[2]))
  expect_true(is.na(result$data$datasetKey[2]))
  expect_true(is.na(result$data$basisOfRecord[2]))
  expect_true(sf::st_equals(sf::st_as_sfc(result$mp),
                            sf::st_as_sfc(result$data$bboxWkt[1]), sparse = FALSE)[1, 1])
})

test_that("no SUSPICIOUS records returns typed empty output without lookups", {
  local_mocked_bindings(
    .fetch_occurrence_record = function(...) stop("must not look up"),
    .package = "gbifout"
  )
  result <- suspicious_boxes(pipeline_result(c("1", "2"), c("OK", "NEEDS_REVIEW")))
  expect_equal(nrow(result$data), 0)
  expect_true(all(c("decimalLatitude", "decimalLongitude", "datasetKey",
                    "basisOfRecord", "bboxWkt") %in% names(result$data)))
  expect_identical(result$mp, "MULTIPOLYGON EMPTY")

  empty <- suspicious_boxes(pipeline_result(character(), character()))
  expect_identical(empty$mp, "MULTIPOLYGON EMPTY")
})

test_that("lookup errors name the GBIF ID and invalid inputs stop", {
  local_mocked_bindings(
    .fetch_occurrence_record = function(...) stop("not found"),
    .package = "gbifout"
  )
  expect_error(suspicious_boxes(pipeline_result("99", "SUSPICIOUS")),
               "GBIF ID 99: not found")
  expect_error(suspicious_boxes(list(data = data.frame(gbifid = "1"))), "pipeline")
  expect_error(suspicious_boxes(data.frame()), "pipeline")
  expect_error(suspicious_boxes(pipeline_result("1", "OK"), halfWidth = 0), "halfWidth")
  expect_error(suspicious_boxes(pipeline_result("1", "OK"), halfWidth = NA), "halfWidth")
})
