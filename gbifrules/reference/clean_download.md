# Clean a GBIF download of suspicious records using complex rules

Removes records that have been marked as suspicious by annotation users
using complex rules. Only filters based on SUSPICIOUS annotations,
ignoring other annotation types. If project_id is provided, only rules
belonging to those project(s) will be used.

## Usage

``` r
clean_download(
  d,
  rm_suspicious = TRUE,
  handle_conflicts = "favor_suspicious",
  project_id = NULL
)
```

## Arguments

- d:

  a GBIF download in DWCA format

- rm_suspicious:

  removes records with suspicious annotations

- handle_conflicts:

  how to handle conflicting annotations

- project_id:

  optional project ID(s) to filter rules by specific project(s). Can be
  a single ID or vector of IDs.

## Value

A cleaned download \`data.frame()\`

## Examples
