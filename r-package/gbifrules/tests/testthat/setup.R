library(httptest2)

# Skip all tests on CRAN and CI
skip_on_cran()
skip_on_ci()

# Set environment variable for all tests
Sys.setenv(GBIFRULES_URL = "http://localhost:8080/occurrence/experimental/annotation/")
