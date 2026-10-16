.fetch_test_wkts <- c(
  "POLYGON ((0 0, 1 0, 1 1, 0 1, 0 0))",
  "POLYGON ((1 0, 2 0, 2 1, 1 1, 1 0))"
)

.fetch_test_rows <- function(keys) {
  data.frame(
    key = as.character(keys),
    basisOfRecord = "HUMAN_OBSERVATION",
    decimalLatitude = seq_along(keys),
    decimalLongitude = 0,
    datasetKey = "dataset",
    taxonKey = 1
  )
}

test_that("finder results pipe directly into fetching using their taxon key", {
  calls <- list()
  local_mocked_bindings(
    occ_search = function(...) {
      calls[[length(calls) + 1]] <<- list(...)
      list(meta = list(offset = 0, count = 1, endOfRecords = TRUE),
           data = .fetch_test_rows("123"))
    },
    .package = "gbifout"
  )
  polygons <- list(taxonKey = "3NFRS",
                   candidates = data.frame(binWkt = .fetch_test_wkts[1]))
  result <- polygons |> occ_fetch_unique()
  expect_identical(calls[[1]]$taxonKey, "3NFRS")
  expect_identical(result$gbifid, "123")
  expect_identical(names(formals(occ_fetch_unique)), c("result", "basisOfRecord", "sampleSize"))
  expect_error(occ_fetch_unique(polygons, taxonKey = "override"), "unused argument")
  expect_error(occ_fetch_unique(list(candidates = polygons$candidates)), "taxonKey")
})

test_that("fetching paginates and uses candidates only", {
  calls <- list()
  rows <- .fetch_test_rows(seq_len(301))
  local_mocked_bindings(
    occ_search = function(...) {
      request <- list(...)
      calls[[length(calls) + 1]] <<- request
      selected <- if (request$start == 0) 1:300 else 301
      list(
        meta = list(offset = request$start, count = 301,
                    endOfRecords = request$start == 300),
        data = rows[selected, , drop = FALSE]
      )
    },
    .package = "gbifout"
  )
  polygons <- list(taxonKey = "taxon", candidates = data.frame(binWkt = .fetch_test_wkts[1]),
                   mp = "never query mp", hdp = "never query hdp")
  result <- occ_fetch_unique(polygons, sampleSize = NULL)
  expect_equal(nrow(result), 301)
  expect_identical(names(result), c("gbifid", "binWkt"))
  expect_identical(result$gbifid, as.character(seq_len(301)))
  expect_equal(vapply(calls, function(request) request$start, numeric(1)), c(0, 300))
  expect_true(all(vapply(calls, function(request) {
    identical(request$geometry, .fetch_test_wkts[1]) && request$limit == 300 &&
      request$occurrenceStatus == "PRESENT" &&
      identical(request$basisOfRecord, paste(
        eval(formals(out_cand)$basisOfRecord), collapse = ";"
      ))
  }, logical(1))))
})

test_that("sampling caps each polygon only after deduplication", {
  first <- .fetch_test_rows(as.character(1:7))
  repeated <- first[c(1, 1), ]
  repeated$key <- c("duplicate-a", "duplicate-b")
  first <- rbind(first, repeated)
  second <- .fetch_test_rows(as.character(8:10))
  second$datasetKey <- "second dataset"
  local_mocked_bindings(
    occ_search = function(...) {
      data <- if (list(...)$geometry == .fetch_test_wkts[1]) first else second
      list(meta = list(offset = 0, count = nrow(data), endOfRecords = TRUE), data = data)
    },
    .package = "gbifout"
  )
  polygons <- list(taxonKey = "taxon", candidates = data.frame(binWkt = .fetch_test_wkts))
  result <- occ_fetch_unique(polygons)
  expect_equal(sum(result$binWkt == .fetch_test_wkts[1]), 5)
  expect_equal(sum(result$binWkt == .fetch_test_wkts[2]), 3)
  expect_false(any(grepl("duplicate", result$gbifid)))
  expect_equal(anyDuplicated(result$gbifid), 0)
  expect_true(all(result$gbifid %in% as.character(1:10)))
  expect_equal(nrow(occ_fetch_unique(polygons, sampleSize = 1)), 2)
  expect_equal(nrow(occ_fetch_unique(polygons, sampleSize = NULL)), 10)
  for (invalid in list(0, -1, 1.5, NA_real_, Inf, "5", c(1, 2))) {
    expect_error(occ_fetch_unique(polygons, sampleSize = invalid), "positive integer")
  }
})

test_that("basis channels can be overridden or left unfiltered", {
  calls <- list()
  local_mocked_bindings(
    occ_search = function(...) {
      calls[[length(calls) + 1]] <<- list(...)
      list(meta = list(offset = 0, count = 0, endOfRecords = TRUE), data = NULL)
    },
    .package = "gbifout"
  )
  polygons <- list(taxonKey = "taxon", candidates = data.frame(binWkt = .fetch_test_wkts[1]))
  occ_fetch_unique(polygons, basisOfRecord = "MATERIAL_CITATION")
  occ_fetch_unique(polygons,
                   basisOfRecord = c(" HUMAN_OBSERVATION ", "OBSERVATION", "OBSERVATION"))
  occ_fetch_unique(polygons, basisOfRecord = NULL)
  expect_identical(calls[[1]]$basisOfRecord, "MATERIAL_CITATION")
  expect_identical(calls[[2]]$basisOfRecord, "HUMAN_OBSERVATION;OBSERVATION")
  expect_null(calls[[3]]$basisOfRecord)
  expect_identical(eval(formals(occ_fetch_unique)$basisOfRecord),
                   eval(formals(out_cand)$basisOfRecord))
  expect_error(occ_fetch_unique(polygons, basisOfRecord = NA_character_),
               "non-empty character vector")
  expect_error(occ_fetch_unique(polygons, basisOfRecord = "A;B"),
               "individual channels")
})

test_that("deduplication uses exactly four fields across polygons and pages", {
  first <- .fetch_test_rows(c("5195998433", "2"))
  first$decimalLatitude <- c(1, 1)
  first$taxonKey <- c(1, 2)
  second <- .fetch_test_rows(c("5195998433", "3", "4", "5", "6", "7"))
  second$decimalLatitude <- c(1, 1, 1, 1, 2, 1)
  second$basisOfRecord[3] <- "PRESERVED_SPECIMEN"
  second$datasetKey[4] <- "other dataset"
  second$decimalLongitude[6] <- 1
  calls <- 0
  local_mocked_bindings(
    occ_search = function(...) {
      request <- list(...)
      calls <<- calls + 1
      data <- if (request$geometry == .fetch_test_wkts[1]) first else second
      list(meta = list(offset = 0, count = nrow(data), endOfRecords = TRUE), data = data)
    },
    .package = "gbifout"
  )
  result <- occ_fetch_unique(list(
    taxonKey = "taxon",
    candidates = data.frame(binWkt = c(.fetch_test_wkts, .fetch_test_wkts[1]))
  ))
  expect_equal(calls, 2)
  expect_identical(result$gbifid, c("5195998433", "4", "5", "6", "7"))
  expect_identical(result$binWkt, c(.fetch_test_wkts[1], rep(.fetch_test_wkts[2], 4)))
})

test_that("empty candidates return typed empty data without queries", {
  local_mocked_bindings(occ_search = function(...) stop("must not query"), .package = "gbifout")
  result <- occ_fetch_unique(list(
    taxonKey = "taxon",
    candidates = data.frame(binWkt = character()), hdp = .fetch_test_wkts[1]
  ))
  expect_identical(result, data.frame(gbifid = character(), binWkt = character()))
  empty_geometry <- occ_fetch_unique(list(
    taxonKey = "taxon",
    candidates = data.frame(binWkt = "MULTIPOLYGON EMPTY")
  ))
  expect_identical(empty_geometry, result)
})

test_that("duplicates crossing page boundaries retain the first GBIF ID", {
  rows <- .fetch_test_rows(c("1", "2", "3"))
  rows$decimalLatitude <- c(1, 2, 1)
  local_mocked_bindings(
    occ_search = function(...) {
      start <- list(...)$start
      selected <- if (start == 0) 1:2 else 3
      list(meta = list(offset = start, count = 3, endOfRecords = start == 2),
           data = rows[selected, , drop = FALSE])
    },
    .package = "gbifout"
  )
  result <- occ_fetch_unique(list(taxonKey = "taxon", candidates = data.frame(binWkt = .fetch_test_wkts[1])))
  expect_identical(result$gbifid, c("1", "2"))
})

test_that("malformed API data and paging metadata are rejected", {
  polygons <- list(taxonKey = "taxon", candidates = data.frame(binWkt = .fetch_test_wkts[1]))
  local_mocked_bindings(
    occ_search = function(...) list(
      meta = list(offset = 0, count = 1, endOfRecords = TRUE),
      data = data.frame(key = "1")
    ),
    .package = "gbifout"
  )
  expect_error(occ_fetch_unique(polygons), "is missing: basisOfRecord")
  local_mocked_bindings(
    occ_search = function(...) list(meta = list(count = 1), data = .fetch_test_rows("1")),
    .package = "gbifout"
  )
  expect_error(occ_fetch_unique(polygons), "Invalid paging metadata")
})

test_that("invalid inputs are rejected before searching", {
  expect_error(occ_fetch_unique(.fetch_test_wkts), "finder result")
  expect_error(occ_fetch_unique(list(taxonKey = "taxon", candidates = data.frame(binWkt = NA_character_))),
               "non-empty")
  expect_error(occ_fetch_unique(list(taxonKey = "taxon", candidates = data.frame(binWkt = "POINT (0 0)"))),
               "POLYGON")
  expect_error(occ_fetch_unique(list(taxonKey = NA, candidates = data.frame(binWkt = .fetch_test_wkts[1]))),
               "taxonKey")
})

test_that("empty terminal searches return no records", {
  local_mocked_bindings(
    occ_search = function(...) list(
      meta = list(offset = 0, count = 0, endOfRecords = TRUE), data = NULL
    ),
    .package = "gbifout"
  )
  result <- occ_fetch_unique(list(taxonKey = "taxon", candidates = data.frame(binWkt = .fetch_test_wkts[1])))
  expect_identical(result, data.frame(gbifid = character(), binWkt = character()))
})

test_that("failed and incomplete searches never return partial results", {
  polygons <- list(taxonKey = "taxon", candidates = data.frame(binWkt = .fetch_test_wkts[1]))
  local_mocked_bindings(
    occ_search = function(...) stop("network failure"), .package = "gbifout"
  )
  expect_error(occ_fetch_unique(polygons), "polygon 1 at start 0: network failure")
  local_mocked_bindings(
    occ_search = function(...) list(
      meta = list(offset = 0, count = 5, endOfRecords = FALSE), data = data.frame()
    ),
    .package = "gbifout"
  )
  expect_error(occ_fetch_unique(polygons), "empty page before completion")
  local_mocked_bindings(
    occ_search = function(...) list(
      meta = list(offset = 0, count = 5, endOfRecords = TRUE), data = .fetch_test_rows("1")
    ),
    .package = "gbifout"
  )
  expect_error(occ_fetch_unique(polygons), "ended before all records")
})