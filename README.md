# GBIF Occurrence Annotation System

![R Package Tests](https://github.com/gbif/occurrence-annotation/actions/workflows/test-r-package.yml/badge.svg) 
![Backend Tests](https://github.com/gbif/occurrence-annotation/actions/workflows/test-backend-service.yml/badge.svg)
![pkgdown](https://github.com/gbif/occurrence-annotation/actions/workflows/pkgdown.yaml/badge.svg)

A system for rule-based annotation and quality control of GBIF occurrence data. This monorepo contains the backend service, R package, and web UI for creating, managing, and applying annotation rules to GBIF mediated occurrence records.

Authentication is required to use the annotation system. You can create a GBIF account at [GBIF.org](https://www.gbif.org/). You use your GBIF username and password to authenticate API requests. 

## Repository Structure

This is a monorepo containing three main components:

```
occurrence-annotation/
├── backend-service/     # Spring Boot REST API service
├── r-package/gbifrules/ # R package for programmatic access
└── ui/                  # React web application
```

### Web UI

Visit [https://labs.gbif.org/annotations/](https://labs.gbif.org/annotations/) to start creating annotation rules through the web interface.

[UI Documentation](./ui/README.md)

### Backend Service

A Spring Boot REST API that provides the core annotation functionality.

The REST API is available at `https://labs.gbif.org/occurrence/experimental/annotation/`

#### Example: Create a Rule

```bash
curl -X POST "https://labs.gbif.org/occurrence/experimental/annotation/rule" \
  -H "Content-Type: application/json" \
  -u "username:password" \
  -d '{
    "projectId": 123,
    "title": "Suspicious coastal records",
    "body": "Marine species found far inland",
    "wkt": "POLYGON((-60 -5, -50 -5, -50 5, -60 5, -60 -5))",
    "taxonKeys": [2435098],
    "basisOfRecord": ["HUMAN_OBSERVATION"]
  }'
```

[Full API Documentation](./backend-service/README.md)

### R Package (gbifrules)

An R package providing an interface to the GBIF rule-based annotation API.

- Define rules programmatically
- Create and manage projects
- Clean GBIF downloads 

#### Installation and Usage

```r
# Install from GitHub
# install.packages("pak")
pak::pak("gbif/occurrence-annotation/r-package/gbifrules")

# Load the package
library(gbifrules)

# Set your GBIF credentials in .Renviron
usethis::edit_r_environ()
# Add these lines to your .Renviron file:
# GBIF_USER=your_username
# GBIF_PWD=your_password
# Then restart R for changes to take effect

# Create an annotation rule
rule <- make_rule(
  taxonKey = 2431950,  
  wkt = "POLYGON((-10 35, 10 35, 10 45, -10 45, -10 35))",
  annotation = "SUSPICIOUS"
)

# Get existing rules
rules <- get_rule(taxonKey = 2431950)

# Clean a GBIF download using rgbif
library(rgbif)
d <- occ_download_get('0004693-260120142942310') %>%
  occ_download_import()

clean_download(d)
```

[See full R package tutorial](https://gbif.github.io/occurrence-annotation/gbifrules/articles/getting-started.html) | [R Package Documentation](https://gbif.github.io/occurrence-annotation/gbifrules/)

## Related Resources

- [GBIF.org](https://www.gbif.org/) - Global Biodiversity Information Facility
- [GBIF API Documentation](https://www.gbif.org/developer/summary)
- [rgbif R Package](https://docs.ropensci.org/rgbif/) - Access GBIF data in R
