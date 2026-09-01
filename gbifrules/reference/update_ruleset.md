# Update a ruleset

Update a ruleset

## Usage

``` r
update_ruleset(
  id = NULL,
  projectId = NULL,
  name = NULL,
  description = NULL,
  members = NULL,
  deleted = NULL,
  createdBy = NULL,
  keep_members = TRUE,
  user = NULL,
  pwd = NULL
)
```

## Arguments

- id:

  of ruleset.

- projectId:

  id of project ruleset belongs.

- name:

  new name of ruleset.

- description:

  new description of ruleset.

- members:

  new members of ruleset. If \`keep_members=TRUE\`, then new will be
  added to old members.

- deleted:

  logical should the ruleset be deleted or restored.

- createdBy:

  new creator of ruleset.

- keep_members:

  keep old members. Default is TRUE.

- user:

  (character) Optional username for authentication. Defaults to
  GBIF_USER environment variable.

- pwd:

  (character) Optional password for authentication. Defaults to GBIF_PWD
  environment variable.

## Value

A \`list\` of an updated ruleset.

## Examples

``` r
if (FALSE) { # \dontrun{
update_ruleset(1,1,name="new name")
} # }
```
