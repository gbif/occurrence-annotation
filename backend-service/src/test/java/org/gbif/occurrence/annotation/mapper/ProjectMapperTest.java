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

import org.gbif.occurrence.annotation.EmbeddedPostgres;
import org.gbif.occurrence.annotation.config.TestSecurityConfig;
import org.gbif.occurrence.annotation.model.Project;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(EmbeddedPostgres.class)
@SpringBootTest
@Transactional
@SpringJUnitConfig
@Import(TestSecurityConfig.class)
@TestPropertySource(locations = "classpath:test-application.properties")
public class ProjectMapperTest {

  @Autowired private ProjectMapper projectMapper;

  @DynamicPropertySource
  static void configureProperties(DynamicPropertyRegistry registry) {
    PostgreSQLContainer postgres = EmbeddedPostgres.getPostgres();
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.datasource.driver-class-name", postgres::getDriverClassName);
  }

  private Project createTestProject(String username) {
    return Project.builder()
        .name("Test Project")
        .description("Test project description")
        .members(new String[] {username})
        .createdBy(username)
        .build();
  }

  @Test
  public void testCountActiveByCreatedBy() {
    // Initially, count should be 0 for new user
    int initialCount = projectMapper.countActiveByCreatedBy("test-user-count");
    assertEquals(0, initialCount, "Initial count should be 0");

    // Create 3 projects for test-user-count
    for (int i = 0; i < 3; i++) {
      Project project = createTestProject("test-user-count");
      project.setName("Test Project " + i);
      projectMapper.create(project);
    }

    // Count should be 3
    int count = projectMapper.countActiveByCreatedBy("test-user-count");
    assertEquals(3, count, "Should count 3 projects for test-user-count");

    // Create 2 projects for another user
    for (int i = 0; i < 2; i++) {
      Project project = createTestProject("another-user");
      project.setName("Another Project " + i);
      projectMapper.create(project);
    }

    // test-user-count should still have 3 projects
    count = projectMapper.countActiveByCreatedBy("test-user-count");
    assertEquals(
        3,
        count,
        "test-user-count should still have 3 projects after another user creates projects");

    // another-user should have 2 projects
    int anotherUserCount = projectMapper.countActiveByCreatedBy("another-user");
    assertEquals(2, anotherUserCount, "another-user should have 2 projects");
  }

  @Test
  public void testCountActiveByCreatedByExcludesDeletedProjects() {
    // Create 3 projects for test-user-deleted
    Project project1 = createTestProject("test-user-deleted");
    project1.setName("Project 1");
    projectMapper.create(project1);

    Project project2 = createTestProject("test-user-deleted");
    project2.setName("Project 2");
    projectMapper.create(project2);

    Project project3 = createTestProject("test-user-deleted");
    project3.setName("Project 3");
    projectMapper.create(project3);

    // Count should be 3
    int count = projectMapper.countActiveByCreatedBy("test-user-deleted");
    assertEquals(3, count, "Should count 3 active projects");

    // Delete one project
    projectMapper.delete(project2.getId(), "test-user-deleted");

    // Count should now be 2
    count = projectMapper.countActiveByCreatedBy("test-user-deleted");
    assertEquals(
        2,
        count,
        "Should count 2 active projects after deleting one (deleted projects not counted)");
  }
}
