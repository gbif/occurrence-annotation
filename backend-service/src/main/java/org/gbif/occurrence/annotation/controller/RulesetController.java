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

import org.gbif.occurrence.annotation.mapper.RuleMapper;
import org.gbif.occurrence.annotation.mapper.RulesetMapper;
import org.gbif.occurrence.annotation.model.Ruleset;

import java.util.Arrays;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.*;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import static org.gbif.occurrence.annotation.controller.AuthAdvice.assertCreatorOrAdmin;

@Tag(name = "Occurrence annotation rulesets")
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/occurrence/experimental/annotation/ruleset")
public class RulesetController implements Controller<Ruleset> {
  @Autowired private RulesetMapper rulesetMapper;
  @Autowired private RuleMapper ruleMapper;

  @Operation(summary = "List all rulesets that are not deleted")
  @Parameter(name = "projectId", description = "Filters by projectId")
  @Parameter(name = "limit", description = "The limit for paging")
  @Parameter(name = "offset", description = "The offset for paging")
  @GetMapping
  public List<Ruleset> list(
      @RequestParam(required = false) Integer projectId,
      @RequestParam(required = false) Integer limit,
      @RequestParam(required = false) Integer offset) {
    int limitInt = limit == null ? 100 : limit;
    int offsetInt = offset == null ? 0 : offset;
    return rulesetMapper.list(projectId, limitInt, offsetInt);
  }

  @Operation(summary = "Get a single ruleset (may be deleted)")
  @GetMapping("/{id}")
  @Override
  public Ruleset get(@PathVariable(value = "id") int id) {
    return rulesetMapper.get(id);
  }

  @Operation(summary = "Create a new ruleset")
  @PostMapping
  @Secured("USER")
  @Override
  public Ruleset create(@Valid @RequestBody Ruleset ruleset) {
    String username = getLoggedInUser();
    ruleset.setCreatedBy(username);
    ruleset.setMembers(new String[] {username}); // creator is always a member
    rulesetMapper.create(ruleset); // mybatis sets id
    return rulesetMapper.get(ruleset.getId());
  }

  @Operation(summary = "Update a ruleset")
  @PutMapping("/{id}")
  @Secured("USER")
  public Ruleset update(@PathVariable(value = "id") int id, @Valid @RequestBody Ruleset ruleset) {
    Ruleset existing = rulesetMapper.get(id);

    // only members can update
    if (existing == null || !Arrays.asList(existing.getMembers()).contains(getLoggedInUser())) {
      throw new IllegalArgumentException("User must be a member of the ruleset being updated");
    }

    // ensure there is at least one editor
    if (ruleset.getMembers() == null || ruleset.getMembers().length == 0) {
      throw new IllegalArgumentException("Ruleset must have at least one member");
    }

    ruleset.setModifiedBy(getLoggedInUser());
    ruleset.setId(id); // defensive
    rulesetMapper.update(ruleset);
    return rulesetMapper.get(id);
  }

  @Operation(summary = "Logical delete a ruleset and all associated rules")
  @DeleteMapping("/{id}")
  @Secured({"USER", "REGISTRY_ADMIN"})
  @Override
  public Ruleset delete(@PathVariable(value = "id") int id) {
    Ruleset existing = rulesetMapper.get(id);
    assertCreatorOrAdmin(existing.getCreatedBy());
    String username = getLoggedInUser();
    rulesetMapper.delete(id, username);
    // admin or ruleset creator can delete anyone's rules within the ruleset
    ruleMapper.deleteByRuleset(id, username);
    // comments are not findable, so aren't deleted
    return rulesetMapper.get(id);
  }
}
