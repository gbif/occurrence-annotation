# Get project vocabulary

Get the custom vocabulary for a project, or the default system
vocabulary if no custom vocabulary is defined.

## Usage

``` r
get_project_vocab(id)
```

## Arguments

- id:

  the project id (required).

## Value

a \`tibble\` with vocabulary terms containing columns: term,
description, color, locked.

## Details

Returns the annotation vocabulary for a project. If the project has a
custom vocabulary defined, it will be returned. Otherwise, returns the
default system vocabulary which includes NATIVE, INTRODUCED, MANAGED,
FORMER, VAGRANT, SUSPICIOUS, and OTHER.

## Examples

``` r
if (FALSE) { # \dontrun{
get_project_vocabulary(1)
} # }
```
