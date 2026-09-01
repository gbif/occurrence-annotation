# Get top rule creators

Returns top rule creators ordered by number of rules created.

## Usage

``` r
get_top_creators(limit = 10)
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
# Get top 10 rule creators
get_top_creators()

# Get top 25 creators
get_top_creators(limit = 25)
} # }
```
