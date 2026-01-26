library(httptest2)

# Skip all tests on CRAN
skip_on_cran()

# Set environment variable for all tests
Sys.setenv(GBIFRULES_URL = "http://localhost:8080/occurrence/experimental/annotation/")
