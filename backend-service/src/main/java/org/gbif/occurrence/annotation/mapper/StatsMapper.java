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
package org.gbif.occurrence.annotation.mapper;

import org.gbif.occurrence.annotation.model.CreatorStats;
import org.gbif.occurrence.annotation.model.ProjectStats;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface StatsMapper {

  /**
   * Get top rule creators ordered by rule count.
   *
   * @param limit Maximum number of creators to return
   * @return List of creator statistics
   */
  List<CreatorStats> getTopCreators(@Param("limit") int limit);

  /**
   * Get top rule creators ordered by total support count.
   *
   * @param limit Maximum number of creators to return
   * @return List of creator statistics
   */
  List<CreatorStats> getMostSupportedCreators(@Param("limit") int limit);

  /**
   * Get top projects ordered by rule count.
   *
   * @param limit Maximum number of projects to return
   * @return List of project statistics
   */
  List<ProjectStats> getTopProjects(@Param("limit") int limit);

  /**
   * Get top projects ordered by total support count.
   *
   * @param limit Maximum number of projects to return
   * @return List of project statistics
   */
  List<ProjectStats> getMostSupportedProjects(@Param("limit") int limit);
}
