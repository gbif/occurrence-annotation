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

import org.gbif.occurrence.annotation.mapper.StatsMapper;
import org.gbif.occurrence.annotation.model.CreatorStats;
import org.gbif.occurrence.annotation.model.ProjectStats;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Community Statistics")
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/occurrence/experimental/annotation/stats")
public class StatsController {
  @Autowired private StatsMapper statsMapper;

  @Operation(summary = "Get top rule creators ordered by number of rules created")
  @Parameter(name = "limit", description = "Maximum number of creators to return (default: 10, max: 100)")
  @GetMapping("/top-creators")
  public List<CreatorStats> getTopCreators(
      @RequestParam(required = false, defaultValue = "10") Integer limit) {
    return statsMapper.getTopCreators(sanitizeLimit(limit));
  }

  @Operation(summary = "Get top rule creators ordered by total support count")
  @Parameter(name = "limit", description = "Maximum number of creators to return (default: 10, max: 100)")
  @GetMapping("/most-supported-creators")
  public List<CreatorStats> getMostSupportedCreators(
      @RequestParam(required = false, defaultValue = "10") Integer limit) {
    return statsMapper.getMostSupportedCreators(sanitizeLimit(limit));
  }

  @Operation(summary = "Get top projects ordered by number of rules")
  @Parameter(name = "limit", description = "Maximum number of projects to return (default: 10, max: 100)")
  @GetMapping("/top-projects")
  public List<ProjectStats> getTopProjects(
      @RequestParam(required = false, defaultValue = "10") Integer limit) {
    return statsMapper.getTopProjects(sanitizeLimit(limit));
  }

  @Operation(summary = "Get top projects ordered by total support count")
  @Parameter(name = "limit", description = "Maximum number of projects to return (default: 10, max: 100)")
  @GetMapping("/most-supported-projects")
  public List<ProjectStats> getMostSupportedProjects(
      @RequestParam(required = false, defaultValue = "10") Integer limit) {
    return statsMapper.getMostSupportedProjects(sanitizeLimit(limit));
  }

  /**
   * Sanitize limit parameter to ensure it's within valid range.
   * Returns 10 if limit is null, negative, or zero.
   * Returns 100 if limit exceeds maximum.
   */
  private Integer sanitizeLimit(Integer limit) {
    if (limit == null || limit < 1) {
      return 10;
    }
    return Math.min(limit, 100);
  }
}
