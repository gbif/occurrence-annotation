# Get most supported rule creators

Returns top rule creators ordered by total support count (sum of
supports across all their rules).

## Usage

``` r
get_most_supported_creators(limit = 10)
```

## Arguments

- limit:

  (integer) Maximum number of creators to return (default: 10, max:
  100).

## Value

A \`tibble\` with columns: username, ruleCount, totalSupports,
totalContests, projectCount.

## Examples

``` r
if (FALSE) { # \dontrun{
# Get top 10 most supported creators
get_most_supported_creators()

# Get top 25 most supported creators
get_most_supported_creators(limit = 25)
} # }
```
