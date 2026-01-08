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

import org.gbif.occurrence.annotation.mapper.ProjectMapper;
import org.gbif.occurrence.annotation.mapper.RuleMapper;
import org.gbif.occurrence.annotation.mapper.RulesetMapper;
import org.gbif.occurrence.annotation.model.Project;

import java.util.Arrays;
import java.util.List;

import javax.validation.Valid;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.*;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

import static org.gbif.occurrence.annotation.controller.AuthAdvice.assertCreatorOrAdmin;

@Tag(name = "Occurrence annotation projects")
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/occurrence/experimental/annotation/project")
public class ProjectController implements Controller<Project> {
  @Autowired private ProjectMapper projectMapper;
  @Autowired private RulesetMapper rulesetMapper;
  @Autowired private RuleMapper ruleMapper;

  @Operation(summary = "List all projects that are not deleted")
  @Parameter(name = "limit", description = "The limit for paging", example = "100")
  @Parameter(name = "offset", description = "The offset for paging", example = "0")
  @Parameter(
      name = "member",
      description =
          "Filter projects by member username (returns only projects where this user is a member)",
      example = "jwaller")
  @GetMapping
  public List<Project> list(
      @RequestParam(required = false) Integer limit,
      @RequestParam(required = false) Integer offset,
      @RequestParam(required = false) String member) {
    int limitInt = limit == null ? 100 : limit;
    int offsetInt = offset == null ? 0 : offset;
    return projectMapper.list(limitInt, offsetInt, member);
  }

  @Operation(summary = "Get a single project (may be deleted)")
  @GetMapping("/{id}")
  @Override
  public Project get(@PathVariable(value = "id") int id) {
    return projectMapper.get(id);
  }

  @Operation(summary = "Create a new project")
  @PostMapping
  @Secured("USER")
  @Override
  public Project create(@Valid @RequestBody Project project) {
    String username = getLoggedInUser();
    project.setCreatedBy(username);
    project.setMembers(new String[] {username}); // creator is always a member
    projectMapper.create(project); // mybatis sets id
    return projectMapper.get(project.getId());
  }

  @Operation(summary = "Update a project")
  @PutMapping("/{id}")
  @Secured("USER")
  public Project update(@PathVariable(value = "id") int id, @Valid @RequestBody Project project) {
    Project existing = projectMapper.get(id);

    // only members can update
    if (existing == null || !Arrays.asList(existing.getMembers()).contains(getLoggedInUser())) {
      throw new IllegalArgumentException("User must be a member of the project being updated");
    }

    // ensure there is at least one editor
    if (project.getMembers() == null || project.getMembers().length == 0) {
      throw new IllegalArgumentException("Project must have at least one member");
    }

    String[] members = project.getMembers();
    project.setModifiedBy(getLoggedInUser());
    project.setId(id); // defensive
    projectMapper.update(project);
    rulesetMapper.updateMembersByProject(id, members);
    return projectMapper.get(id);
  }

  @Operation(summary = "Logical delete a project and all associated rules")
  @DeleteMapping("/{id}")
  @Secured({"USER", "REGISTRY_ADMIN"})
  @Override
  public Project delete(@PathVariable(value = "id") int id) {
    Project existing = projectMapper.get(id);
    assertCreatorOrAdmin(existing.getCreatedBy());
    String username = getLoggedInUser();
    projectMapper.delete(id, username);
    // admin or project creator can delete anyone's rules within the project
    rulesetMapper.deleteByProject(id, username);
    ruleMapper.deleteByProject(id, username);
    // comments are not findable, so aren't deleted
    return projectMapper.get(id);
  }
}
