/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.gbif.occurrence.annotation.controller;

import org.gbif.occurrence.annotation.mapper.CommentMapper;
import org.gbif.occurrence.annotation.mapper.RuleMapper;
import org.gbif.occurrence.annotation.model.Comment;
import org.gbif.occurrence.annotation.model.Rule;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import static org.gbif.occurrence.annotation.controller.AuthAdvice.assertCreatorOrAdmin;

@Tag(name = "Occurrence annotation rules")
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/occurrence/experimental/annotation/rule")
public class RuleController implements Controller<Rule> {
  @Autowired private RuleMapper ruleMapper;
  @Autowired private CommentMapper commentMapper;

  @Operation(
      summary =
          "List all rules that are not deleted, optionally filtered by taxonKey, datasetKey, rulesetId, basisOfRecord, yearRange, createdBy, supportedBy, contestedBy and containing the comment text")
  @Parameter(name = "taxonKey", description = "Filters by taxonKey")
  @Parameter(
      name = "contextKey",
      description = "Filters by context key. Use 'null' to find rules with no datasetKey")
  @Parameter(name = "rulesetId", description = "Filters by the given ruleset")
  @Parameter(name = "projectId", description = "Filters by the given project")
  @Parameter(
      name = "basisOfRecord",
      description =
          "Filters by basis of record values (accepts multiple values). Use 'null' to find rules with no basisOfRecord")
  @Parameter(
      name = "basisOfRecordNegated",
      description = "When true, returns rules where basisOfRecord is negated (excluded)")
  @Parameter(
      name = "yearRange",
      description =
          "Filters by year range (e.g., '1000,2025', '*,1990', '1000,*'). Use 'null' to find rules with no yearRange")
  @Parameter(name = "createdBy", description = "Filters by the username who created the rule")
  @Parameter(name = "supportedBy", description = "Filters by rules supported by the given username")
  @Parameter(name = "contestedBy", description = "Filters by rules contested by the given username")
  @Parameter(
      name = "geometry",
      description =
          "Filters by geometry using WKT string. Finds rules with geometries that intersect with the provided geometry. URL encoding should be applied to WKT strings.")
  @Parameter(
      name = "comment",
      description = "Filters to rules with a non-deleted comment containing the given text")
  @Parameter(name = "limit", description = "The limit for paging")
  @Parameter(name = "offset", description = "The offset for paging")
  @GetMapping
  public List<Rule> list(
      @RequestParam(required = false) Integer taxonKey,
      @RequestParam(required = false) String datasetKey,
      @RequestParam(required = false) Integer rulesetId,
      @RequestParam(required = false) Integer projectId,
      @RequestParam(required = false) String[] basisOfRecord,
      @RequestParam(required = false) Boolean basisOfRecordNegated,
      @RequestParam(required = false) String yearRange,
      @RequestParam(required = false) String geometry,
      @RequestParam(required = false) String createdBy,
      @RequestParam(required = false) String supportedBy,
      @RequestParam(required = false) String contestedBy,
      @RequestParam(required = false) String comment,
      @RequestParam(required = false) Integer limit,
      @RequestParam(required = false) Integer offset) {
    int limitInt = limit == null ? 100 : limit;
    int offsetInt = offset == null ? 0 : offset;
    return ruleMapper.list(
        taxonKey,
        datasetKey,
        rulesetId,
        projectId,
        basisOfRecord,
        basisOfRecordNegated,
        yearRange,
        geometry,
        createdBy,
        supportedBy,
        contestedBy,
        comment,
        limitInt,
        offsetInt);
  }

  @Operation(summary = "Get rules created by the current logged-in user")
  @GetMapping("/my")
  @Secured("USER")
  public List<Rule> getMyRules(
      @RequestParam(required = false) Integer taxonKey,
      @RequestParam(required = false) String datasetKey,
      @RequestParam(required = false) Integer rulesetId,
      @RequestParam(required = false) Integer projectId,
      @RequestParam(required = false) String[] basisOfRecord,
      @RequestParam(required = false) Boolean basisOfRecordNegated,
      @RequestParam(required = false) String yearRange,
      @RequestParam(required = false) String geometry,
      @RequestParam(required = false) String comment,
      @RequestParam(required = false) Integer limit,
      @RequestParam(required = false) Integer offset) {
    int limitInt = limit == null ? 100 : limit;
    int offsetInt = offset == null ? 0 : offset;
    String currentUser = getLoggedInUser();
    return ruleMapper.list(
        taxonKey,
        datasetKey,
        rulesetId,
        projectId,
        basisOfRecord,
        basisOfRecordNegated,
        yearRange,
        geometry,
        currentUser, // createdBy = current user
        null, // supportedBy
        null, // contestedBy
        comment,
        limitInt,
        offsetInt);
  }

  @Operation(summary = "Get rules supported by the current logged-in user")
  @GetMapping("/supported")
  @Secured("USER")
  public List<Rule> getSupportedRules(
      @RequestParam(required = false) Integer taxonKey,
      @RequestParam(required = false) String datasetKey,
      @RequestParam(required = false) Integer rulesetId,
      @RequestParam(required = false) Integer projectId,
      @RequestParam(required = false) String[] basisOfRecord,
      @RequestParam(required = false) Boolean basisOfRecordNegated,
      @RequestParam(required = false) String yearRange,
      @RequestParam(required = false) String geometry,
      @RequestParam(required = false) String comment,
      @RequestParam(required = false) Integer limit,
      @RequestParam(required = false) Integer offset) {
    int limitInt = limit == null ? 100 : limit;
    int offsetInt = offset == null ? 0 : offset;
    String currentUser = getLoggedInUser();
    return ruleMapper.list(
        taxonKey,
        datasetKey,
        rulesetId,
        projectId,
        basisOfRecord,
        basisOfRecordNegated,
        yearRange,
        geometry,
        null, // createdBy
        currentUser, // supportedBy = current user
        null, // contestedBy
        comment,
        limitInt,
        offsetInt);
  }

  @Operation(summary = "Get rules contested by the current logged-in user")
  @GetMapping("/contested")
  @Secured("USER")
  public List<Rule> getContestedRules(
      @RequestParam(required = false) Integer taxonKey,
      @RequestParam(required = false) String datasetKey,
      @RequestParam(required = false) Integer rulesetId,
      @RequestParam(required = false) Integer projectId,
      @RequestParam(required = false) String[] basisOfRecord,
      @RequestParam(required = false) Boolean basisOfRecordNegated,
      @RequestParam(required = false) String yearRange,
      @RequestParam(required = false) String geometry,
      @RequestParam(required = false) String comment,
      @RequestParam(required = false) Integer limit,
      @RequestParam(required = false) Integer offset) {
    int limitInt = limit == null ? 100 : limit;
    int offsetInt = offset == null ? 0 : offset;
    String currentUser = getLoggedInUser();
    return ruleMapper.list(
        taxonKey,
        datasetKey,
        rulesetId,
        projectId,
        basisOfRecord,
        basisOfRecordNegated,
        yearRange,
        geometry,
        null, // createdBy
        null, // supportedBy
        currentUser, // contestedBy = current user
        comment,
        limitInt,
        offsetInt);
  }

  @Operation(summary = "Get a single rule (may be deleted)")
  @GetMapping("/{id}")
  @Override
  public Rule get(@PathVariable(value = "id") int id) {
    return ruleMapper.get(id);
  }

  @Operation(summary = "Create a new rule")
  @PostMapping
  @Secured("USER")
  @Override
  public Rule create(@Valid @RequestBody Rule rule) {
    rule.setCreatedBy(getLoggedInUser());
    ruleMapper.create(rule); // id set by mybatis
    return ruleMapper.get(rule.getId());
  }

  @Operation(summary = "Update an existing rule")
  @PutMapping("/{id}")
  @Secured({"USER", "REGISTRY_ADMIN"})
  public Rule update(@PathVariable(value = "id") int id, @Valid @RequestBody Rule rule) {
    Rule existing = ruleMapper.get(id);

    // Check if rule exists and is not deleted
    if (existing == null) {
      throw new IllegalArgumentException("Rule not found with id: " + id);
    }
    if (existing.getDeleted() != null) {
      throw new IllegalArgumentException("Cannot update a deleted rule");
    }

    // Only creator or admin can update
    assertCreatorOrAdmin(existing.getCreatedBy());

    // Set the ID from path parameter to ensure we're updating the correct rule
    rule.setId(id);

    // Update the rule
    ruleMapper.update(rule);

    // Return the updated rule
    return ruleMapper.get(id);
  }

  @Operation(summary = "Logical delete a rule")
  @DeleteMapping("/{id}")
  @Secured({"USER", "REGISTRY_ADMIN"})
  @Override
  public Rule delete(@PathVariable(value = "id") int id) {
    Rule existing = ruleMapper.get(id);
    assertCreatorOrAdmin(existing.getCreatedBy());
    ruleMapper.delete(id, getLoggedInUser());
    return ruleMapper.get(id);
  }

  @Operation(summary = "Adds support for a rule (removes any existing contest entry for the user)")
  @PostMapping("/{id}/support")
  @Secured("USER")
  public Rule support(@PathVariable(value = "id") int id) {
    String username = getLoggedInUser();
    ruleMapper.addSupport(id, username);
    ruleMapper.removeContest(id, username); // contest and support are mutually exclusive
    return ruleMapper.get(id);
  }

  @Operation(summary = "Removes support for a rule for the user")
  @PostMapping("/{id}/removeSupport")
  @Secured("USER")
  public Rule removeSupport(@PathVariable(value = "id") int id) {
    String username = getLoggedInUser();
    ruleMapper.removeSupport(id, username);
    return ruleMapper.get(id);
  }

  @Operation(summary = "Record that the user contests a rule (removes any support from the user)")
  @PostMapping("/{id}/contest")
  @Secured("USER")
  public Rule contest(@PathVariable(value = "id") int id) {
    String username = getLoggedInUser();
    ruleMapper.addContest(id, username);
    ruleMapper.removeSupport(id, username); // contest and support are mutually exclusive
    return ruleMapper.get(id);
  }

  @Operation(summary = "Removes the user contest list for the rule")
  @PostMapping("/{id}/removeContest")
  @Secured("USER")
  public Rule removeContest(@PathVariable(value = "id") int id) {
    String username = getLoggedInUser();
    ruleMapper.removeContest(id, username);
    return ruleMapper.get(id);
  }

  @Operation(summary = "Lists all non-deleted comments for a rule")
  @GetMapping("/{id}/comment")
  public List<Comment> listComment(@PathVariable(value = "id") int ruleId) {
    return commentMapper.list(ruleId);
  }

  @Operation(summary = "Adds a comment")
  @PostMapping("/{id}/comment")
  @Secured("USER")
  public Comment addComment(
      @PathVariable(value = "id") int id, @Valid @RequestBody Comment comment) {
    String username = getLoggedInUser();
    comment.setCreatedBy(username);
    comment.setRuleId(id);
    commentMapper.create(comment); // id set by mybatis
    return commentMapper.get(comment.getId());
  }

  @Operation(summary = "Logical delete a comment")
  @DeleteMapping("/{id}/comment/{commentId}")
  @Secured({"USER", "REGISTRY_ADMIN"})
  public void deleteComment(@PathVariable(value = "commentId") int commentId) {
    Comment existing = commentMapper.get(commentId);
    assertCreatorOrAdmin(existing.getCreatedBy());
    commentMapper.delete(commentId, getLoggedInUser());
  }

  @Operation(
      summary =
          "Provide aggregate metrics for rules, optionally filtered by username, taxonKey, datasetKey, rulesetId and projectId. Returns total counts across all matching rules.")
  @Parameter(name = "username", description = "Filters by the username who created the rules")
  @Parameter(name = "taxonKey", description = "Filters by taxon key")
  @Parameter(name = "datasetKey", description = "Filters by dataset key")
  @Parameter(name = "rulesetId", description = "Filters by the given ruleset")
  @Parameter(name = "projectId", description = "Filters by the given project")
  @GetMapping("/metrics")
  public org.gbif.occurrence.annotation.model.RuleMetrics metrics(
      @RequestParam(required = false) String username,
      @RequestParam(required = false) Integer taxonKey,
      @RequestParam(required = false) String datasetKey,
      @RequestParam(required = false) Integer rulesetId,
      @RequestParam(required = false) Integer projectId) {
    List<org.gbif.occurrence.annotation.model.RuleMetrics> results =
        ruleMapper.metrics(username, taxonKey, datasetKey, rulesetId, projectId);
    return results.isEmpty()
        ? new org.gbif.occurrence.annotation.model.RuleMetrics()
        : results.get(0);
  }
}
