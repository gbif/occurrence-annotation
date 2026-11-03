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

Use the map's Occurrence Filters dialog to search by **GBIF occurrence ID**
(for example, `182368733`), not the publisher-provided occurrence ID. Multiple
IDs can be separated by commas or whitespace. The IDs restrict occurrence tiles,
area investigation results, and the coordinate-less country overlay using `gbifId`,
combined with the selected taxon/checklist and other occurrence filters.
Clear the field or reset filters to remove the restriction. This is a display/search
filter only; GBIF occurrence IDs are never added to saved annotation rules.

Taxon occurrence maps include a subtle dashed grey country overlay for GBIF
records without coordinates. It uses a counts-only country facet request
(`hasCoordinate=false`), not downloaded occurrence records. The main map follows
the selected taxon and occurrence filters; the download-results map shows this
GBIF context when a single taxon is selected (not counts from the uploaded file).
Country shading indicates country-level reports, not precise occurrence locations,
and does not change the map extent or intercept map interactions. Failed requests
are reported in the map legend rather than displayed as zero countries.
All overlays share one collapsed "Overlays" button in the lower right of the map.
It opens a panel with a checkbox per overlay to hide or show its polygons without refetching;
clicking outside the panel collapses it again.
the choice is remembered in localStorage. Overlays with no results do not appear in the panel.
Shading is clipped to the map viewport and the single tiled world, including
dateline-crossing countries, so it does not repeat into the blank map margins.

Taxon maps also show Catalogue of Life distributions as a separate subtle fawn (`#ECAC7C`)
overlay with solid outlines. The UI uses GBIF's ChecklistBank source link to select
the exact COL Extended Release dataset for the selected taxon, then checks its info endpoint
and downloads the supplied ISO or TDWG area's GeoJSON from the ChecklistBank area
API only when distributions exist. Older numeric GBIF Backbone keys are resolved
through an exact canonical-name and rank match in COL Extended Release (`3LXR`)
before querying COL. Distribution
areas are independent of occurrence filters and represent published range
information, not individual records or proof of native status. Establishment
means are shown when supplied by COL. A compact "N areas not shown" disclosure in the
Overlays panel lists areas without drawable boundaries, including free-text-only
distributions. The COL entry is omitted only when no distribution areas are
supplied; request failures remain visible. Both overlays preserve map extent and interactions and
are clipped to the viewport and single tiled world.
Deployments with an HTTP Content-Security-Policy header must also permit
`https://api.checklistbank.org` in `connect-src`.

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

[Documentation](https://gbif.github.io/occurrence-annotation/gbifrules/) | 

## Related Resources

- [GBIF.org](https://www.gbif.org/) - Global Biodiversity Information Facility
- [GBIF API Documentation](https://www.gbif.org/developer/summary)
- [rgbif R Package](https://docs.ropensci.org/rgbif/) - Access GBIF data in R
