# occurrence-annotation

**Experimental** : Rule based annotation store. 

A **rule** is a combination of geographic, taxonomic, or other information that facilitates data cleaning or analysis of occurrence data. 

## Summary of current features :

* Create rules based on location, taxonKey, and datasetKey. 
* Upvote and downvote rules. 
* Comment on rules. 
* Optionally associate rules with rulesets or projects.
* Create rulesets, which are groups of rules. 
* Create projects, which are groups of rulesets. 
* Rules, rulesets, and projects are only editable by members invited by the creator.  
* Collaborate or projects and rulesets with other invited GBIF users. 
* Rule data is open to all.

**Projects** and **rulesets** are logical groupings of rules that allow a group of editors to collaborate and view their results without outside interference. They may, for example, publish their rules as part of their cleaning process for their research. That being said, all rules are available to view for all. 

## Demo UI 

Link to demo. 

## R package interface 

There is an R interface being developed named `gbifan`. It can found [here](https://github.com/jhnwllr/gbifan).  

## Longer description and road map  

https://github.com/jhnwllr/doc-rule-based-annotations/blob/main/index.adoc


## Tests

This project uses [test containers](https://testcontainers.com/) to run unit tests, so you will need to have docker running in the background for the tests to work.   
