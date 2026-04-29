# Update a project

Update a project

## Usage

``` r
update_project(
  id = NULL,
  name = NULL,
  description = NULL,
  members = NULL,
  deleted = NULL,
  createdBy = NULL,
  keep_members = TRUE
)
```

## Arguments

- id:

  project id.

- name:

  new name of project.

- description:

  new description for project.

- members:

  new members. If \`keep_members=TRUE\`, then new will be added to old
  members.

- deleted:

  logical should the project be deleted or restored.

- createdBy:

  new creator of project.

- keep_members:

  keep old members. Default is TRUE.

## Value

A \`list\` with data of the new project.

## Details

Update a project. If fields are left \`NULL\`, then they will not be
updated. If \`keep_memebers=TRUE\`, new members are added to the list of
old members.

## Examples

``` r
if (FALSE) { # \dontrun{
update_project(1,name="New name")
} # }
```
