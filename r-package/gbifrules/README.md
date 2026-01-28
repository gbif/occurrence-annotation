# gbifrules

`gbifrules` is an R package for filtering GBIF occurrence data using spatial annotation rules created by the GBIF community. The package wraps the GBIF occurrence annotation API in order to create and apply user-curated rules that identify suspicious or problematic occurrence records.

**Web Interface:** You can also create and manage annotation rules using the [GBIF Annotation Web UI](https://labs.gbif.org/annotations/).


## Installation

```r
# CRAN version 
install.packages("gbifrules")
# Install development version
pak::pak("gbif/occurrence-annotation/r-package/gbifrules")
```

## Quick Start

### Cleaning GBIF Downloads

```r
library(gbifrules)
library(rgbif)
# Ambystoma mexicanum
# make a fresh download using rgbif
# occ_download(pred("taxonKey" ,"2431950"))

# Download occurrence data from GBIF
d <- occ_download_get('0004693-260120142942310') %>%
  occ_download_import()

# Clean the download using all available annotation rules
clean_download(d)

# Filter your data using only rules from a specific project:
clean_download(d, project_id = 1)

# Filter using rules from multiple projects:
clean_download(d, project_id = c(1, 2, 3))
```

### How clean_download() Works

1. **Fetches rules** from the GBIF API for taxon keys in your data
2. **Applies spatial filters** using polygon geometries from annotation rules
3. **Evaluates additional criteria** like basisOfRecord and datasetKey if specified
4. **Returns cleaned data** with suspicious records removed or flagged

## Creating Annotation Rules

You can create and manage annotation rules programmatically using the `gbifrules` package. Although most of the time it is easier to use the [GBIF Annotation UI](https://labs.gbif.org/annotations/) for rule creation and management. 

### Setting up Authentication

Most write operations require GBIF credentials. Set these as environment variables:

```r
usethis::edit_r_environ()
# Then add these lines:
# GBIF_USER=your_gbif_username
# GBIF_PWD=your_gbif_password
# Save the file and restart R
```

### Creating a Simple Rule

```r
# Create a rule flagging occurrences as suspicious in a specific area
make_rule(
  taxonKey = 431950,  # Ambystoma mexicanum (axolotl)
  geometry = "POLYGON((5 50, 10 50, 10 55, 5 55, 5 50))",
  annotation = "SUSPICIOUS"
)
```

### Creating a Rule with Additional Filters

```r
# Flag only machine observations as suspicious
make_rule(
  taxonKey = 431950,
  geometry = "POLYGON((5 50, 10 50, 10 55, 5 55, 5 50))",
  annotation = "SUSPICIOUS",
  basisOfRecord = c("MACHINE_OBSERVATION"),
  yearRange = "2000,2023"
)
```

### Organizing Rules with Projects

```r
# 1. Create a project to organize related rules
project <- make_project(
  name = "European Oak Distribution",
  description = "Cleaning oak occurrence data in Europe"
)

project_id <- project$id

# 2. Add rules to the project
make_rule(
  taxonKey = 431950,
  geometry = "POLYGON((5 50, 10 50, 10 55, 5 55, 5 50))",
  annotation = "SUSPICIOUS",
  projectId = project_id
)
```

### Viewing and Managing Rules

```r
# Get all rules
get_rule(limit=10)

# Get rules for a specific project
get_rule(projectId = 1)

# Get a specific rule by ID
get_rule(id = 1)

# upvote or downvote a rule
support_rule(id = 1)
contest_rule(id = 1)
```

## Related Resources

- [GBIF Annotation UI](https://labs.gbif.org/annotations/)
- [rgbif package](https://github.com/ropensci/rgbif)

