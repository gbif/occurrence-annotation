# Get most supported projects

Returns top projects ordered by total support count (sum of supports
across all project rules).

## Usage

``` r
get_most_supported_projects(limit = 10)
```

## Arguments

- limit:

  (integer) Maximum number of projects to return (default: 10, max:
  100).

## Value

A \`tibble\` with columns: projectId, projectName, projectDescription,
createdBy, ruleCount, totalSupports, totalContests, memberCount.

## Examples

``` r
if (FALSE) { # \dontrun{
# Get top 10 most supported projects
get_most_supported_projects()

# Get top 25 most supported projects
get_most_supported_projects(limit = 25)
} # }
```
