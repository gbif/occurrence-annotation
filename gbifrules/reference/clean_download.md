# Clean a GBIF download of suspicious records using complex rules

Removes records that have been marked as suspicious by annotation users
using complex rules. Only filters based on SUSPICIOUS annotations,
ignoring other annotation types. If project_id is provided, only rules
belonging to those project(s) will be used. When use_higher_taxonomy is
TRUE, rules can match records at any taxonomic level present in the
download.

## Usage

``` r
clean_download(
  d,
  rm_suspicious = TRUE,
  handle_conflicts = "favor_suspicious",
  project_id = NULL,
  use_higher_taxonomy = TRUE,
  min_support = NULL,
  exclude_contested = FALSE
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

- use_higher_taxonomy:

  logical; if TRUE (default), rules will match records based on higher
  taxonomic ranks. The function checks for matches against kingdomKey,
  phylumKey, classKey, orderKey, familyKey, genusKey, speciesKey, and
  taxonKey columns in the download data. For example, a rule created for
  taxonKey 212 (Aves/Birds) will match all bird species records that
  have classKey = 212.

- min_support:

  integer; minimum number of supports required for a rule to be applied.
  NULL (default) means no minimum. Only rules with at least this many
  supports will be used.

- exclude_contested:

  logical; if TRUE, exclude any rules that have been contested
  (downvoted). Default is FALSE.

## Value

A cleaned download \`data.frame()\`

## Examples
