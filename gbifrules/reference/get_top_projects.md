# Get top projects

Returns top projects ordered by number of rules.

## Usage

``` r
get_top_projects(limit = 10)
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
# Get top 10 projects by rule count
get_top_projects()

# Get top 25 projects
get_top_projects(limit = 25)
} # }
```
