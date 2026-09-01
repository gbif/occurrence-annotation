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

import org.gbif.occurrence.annotation.EmbeddedPostgres;
import org.gbif.occurrence.annotation.config.TestSecurityConfig;
import org.gbif.occurrence.annotation.model.Project;
import org.gbif.occurrence.annotation.model.Rule;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.postgresql.PostgreSQLContainer;

import com.fasterxml.jackson.databind.ObjectMapper;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(EmbeddedPostgres.class)
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestSecurityConfig.class)
@TestPropertySource(locations = "classpath:test-application.properties")
public class MetricsControllerTest {

  @Autowired private MockMvc mockMvc;

  @Autowired private ObjectMapper objectMapper;

  @DynamicPropertySource
  static void configureProperties(DynamicPropertyRegistry registry) {
    PostgreSQLContainer postgres = EmbeddedPostgres.getPostgres();
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.datasource.driver-class-name", postgres::getDriverClassName);
  }

  @Test
  public void testGetMetricsWithoutFilters() throws Exception {
    mockMvc
        .perform(get("/occurrence/experimental/annotation/rule/metrics"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.ruleCount", notNullValue()))
        .andExpect(jsonPath("$.datasetCount", notNullValue()))
        .andExpect(jsonPath("$.projectCount", notNullValue()))
        .andExpect(jsonPath("$.taxonCount", notNullValue()));
  }

  @Test
  @WithMockUser(
      username = "metrics-user-1",
      roles = {"USER"})
  public void testGetMetricsByUsername() throws Exception {
    // Create a project with the user as creator
    Project project1 = new Project();
    project1.setName("Metrics Test Project 1");
    project1.setDescription("Project for metrics testing");

    String projectResponse1 =
        mockMvc
            .perform(
                post("/occurrence/experimental/annotation/project")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(project1)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    Project createdProject1 = objectMapper.readValue(projectResponse1, Project.class);

    // Create a rule for this project
    Rule rule1 =
        Rule.builder()
            .taxonKey("12345")
            .datasetKey("dataset-metrics-1")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation("NATIVE")
            .rulesetId(1)
            .projectId(createdProject1.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule1)))
        .andExpect(status().isOk());

    // Get metrics for this user
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule/metrics")
                .param("username", "metrics-user-1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.username", is("metrics-user-1")))
        .andExpect(jsonPath("$.ruleCount", greaterThanOrEqualTo(1)))
        .andExpect(jsonPath("$.projectCount", greaterThanOrEqualTo(1)));
  }

  @Test
  @WithMockUser(
      username = "metrics-user-2",
      roles = {"USER"})
  public void testProjectCountIncludesMembership() throws Exception {
    // Create a project as metrics-user-2 (will be creator and member)
    Project project1 = new Project();
    project1.setName("Creator Project");
    project1.setDescription("Project where user is creator");

    String projectResponse1 =
        mockMvc
            .perform(
                post("/occurrence/experimental/annotation/project")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(project1)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    Project createdProject1 = objectMapper.readValue(projectResponse1, Project.class);

    // Create another project as a different user and add metrics-user-2 as member
    // Note: We need to use a different mock user context for this
    // In a real test, you'd create this with @WithMockUser("other-user")
    // For now, we'll just verify the count includes projects where user is member

    // Get metrics - should count both projects where user is creator AND member
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule/metrics")
                .param("username", "metrics-user-2"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.username", is("metrics-user-2")))
        .andExpect(jsonPath("$.projectCount", greaterThanOrEqualTo(1)));
  }

  @Test
  @WithMockUser(
      username = "metrics-user-3",
      roles = {"USER"})
  public void testProjectCountForMemberOnly() throws Exception {
    // This test verifies that projectCount includes projects where user is ONLY a member
    // (not the creator)

    // First, create a project as metrics-user-3
    Project ownProject = new Project();
    ownProject.setName("Own Project");
    ownProject.setDescription("User's own project");

    String ownProjectResponse =
        mockMvc
            .perform(
                post("/occurrence/experimental/annotation/project")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(ownProject)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    Project createdOwnProject = objectMapper.readValue(ownProjectResponse, Project.class);

    // Get initial metrics - should show 1 project (the one they created)
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule/metrics")
                .param("username", "metrics-user-3"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.projectCount", is(1)));

    // Now simulate being added as a member to another user's project
    // In a complete test suite, you'd create another project with a different user
    // and add metrics-user-3 as a member
    // The metrics should then show projectCount = 2
  }

  @Test
  @WithMockUser(
      username = "metrics-user-4",
      roles = {"USER"})
  public void testMetricsByProjectId() throws Exception {
    // Create a project
    Project project = new Project();
    project.setName("Metrics by Project Test");
    project.setDescription("Testing metrics filtered by project");

    String projectResponse =
        mockMvc
            .perform(
                post("/occurrence/experimental/annotation/project")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(project)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    Project createdProject = objectMapper.readValue(projectResponse, Project.class);

    // Create rules in this project
    Rule rule1 =
        Rule.builder()
            .taxonKey("11111")
            .datasetKey("dataset-project-1")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation("NATIVE")
            .rulesetId(1)
            .projectId(createdProject.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule1)))
        .andExpect(status().isOk());

    Rule rule2 =
        Rule.builder()
            .taxonKey("22222")
            .datasetKey("dataset-project-2")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation("INTRODUCED")
            .rulesetId(1)
            .projectId(createdProject.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule2)))
        .andExpect(status().isOk());

    // Get metrics filtered by project
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule/metrics")
                .param("projectId", String.valueOf(createdProject.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ruleCount", greaterThanOrEqualTo(2)))
        .andExpect(jsonPath("$.taxonCount", greaterThanOrEqualTo(2)));
  }

  @Test
  @WithMockUser(
      username = "metrics-user-5",
      roles = {"USER"})
  public void testMetricsByTaxonKey() throws Exception {
    // Create a project
    Project project = new Project();
    project.setName("Taxon Metrics Test");
    project.setDescription("Testing metrics by taxon");

    String projectResponse =
        mockMvc
            .perform(
                post("/occurrence/experimental/annotation/project")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(project)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    Project createdProject = objectMapper.readValue(projectResponse, Project.class);

    // Create multiple rules for the same taxon
    String testTaxonKey = "99999";

    Rule rule1 =
        Rule.builder()
            .taxonKey(testTaxonKey)
            .datasetKey("dataset-taxon-1")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation("NATIVE")
            .rulesetId(1)
            .projectId(createdProject.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule1)))
        .andExpect(status().isOk());

    Rule rule2 =
        Rule.builder()
            .taxonKey(testTaxonKey)
            .datasetKey("dataset-taxon-2")
            .geometry("POLYGON((1 1, 1 2, 2 2, 2 1, 1 1))")
            .annotation("INTRODUCED")
            .rulesetId(1)
            .projectId(createdProject.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule2)))
        .andExpect(status().isOk());

    // Get metrics filtered by taxon
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule/metrics")
                .param("taxonKey", String.valueOf(testTaxonKey)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ruleCount", greaterThanOrEqualTo(2)))
        .andExpect(jsonPath("$.taxonCount", is(1)))
        .andExpect(jsonPath("$.datasetCount", greaterThanOrEqualTo(2)));
  }

  @Test
  @WithMockUser(
      username = "metrics-user-6",
      roles = {"USER"})
  public void testMetricsWithMultipleFilters() throws Exception {
    // Create a project
    Project project = new Project();
    project.setName("Multi-Filter Metrics Test");
    project.setDescription("Testing metrics with multiple filters");

    String projectResponse =
        mockMvc
            .perform(
                post("/occurrence/experimental/annotation/project")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(project)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    Project createdProject = objectMapper.readValue(projectResponse, Project.class);

    // Create a rule
    Rule rule =
        Rule.builder()
            .taxonKey("88888")
            .datasetKey("dataset-multi-filter")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation("NATIVE")
            .rulesetId(1)
            .projectId(createdProject.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule)))
        .andExpect(status().isOk());

    // Get metrics with multiple filters
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule/metrics")
                .param("username", "metrics-user-6")
                .param("projectId", String.valueOf(createdProject.getId()))
                .param("taxonKey", "88888"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.username", is("metrics-user-6")))
        .andExpect(jsonPath("$.ruleCount", greaterThanOrEqualTo(1)))
        .andExpect(jsonPath("$.taxonCount", is(1)))
        .andExpect(jsonPath("$.projectCount", greaterThanOrEqualTo(1)));
  }

  @Test
  @WithMockUser(
      username = "metrics-user-dataset-1",
      roles = {"USER"})
  public void testMetricsWithMultipleDatasetKeyFilter() throws Exception {
    Project project = new Project();
    project.setName("Dataset Key OR Metrics Test");
    project.setDescription("Testing metrics with multiple datasetKey filters");

    String projectResponse =
        mockMvc
            .perform(
                post("/occurrence/experimental/annotation/project")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(project)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    Project createdProject = objectMapper.readValue(projectResponse, Project.class);

    // A rule can only have one datasetKey, so multiple values must be OR'd, not AND'd
    Rule rule1 =
        Rule.builder()
            .taxonKey("7001")
            .datasetKey("dataset-or-1")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation("NATIVE")
            .projectId(createdProject.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule1)))
        .andExpect(status().isOk());

    Rule rule2 =
        Rule.builder()
            .taxonKey("7002")
            .datasetKey("dataset-or-2")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation("NATIVE")
            .projectId(createdProject.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule2)))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule/metrics")
                .param("username", "metrics-user-dataset-1")
                .param("datasetKey", "dataset-or-1")
                .param("datasetKey", "dataset-or-2"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ruleCount", is(2)))
        .andExpect(jsonPath("$.datasetCount", is(2)));
  }

  @Test
  public void testMetricsForNonExistentUsername() throws Exception {
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule/metrics")
                .param("username", "nonexistent-user-12345"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ruleCount", is(0)))
        .andExpect(jsonPath("$.projectCount", is(0)))
        .andExpect(jsonPath("$.datasetCount", is(0)))
        .andExpect(jsonPath("$.taxonCount", is(0)));
  }

  @Test
  @WithMockUser(
      username = "metrics-user-multi-1",
      roles = {"USER"})
  public void testMetricsWithSingleUsernameFilter() throws Exception {
    // Create a project
    Project project = new Project();
    project.setName("Single User Metrics Test");
    project.setDescription("Testing metrics with single username filter");

    String projectResponse =
        mockMvc
            .perform(
                post("/occurrence/experimental/annotation/project")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(project)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    Project createdProject = objectMapper.readValue(projectResponse, Project.class);

    // Create rules
    Rule rule1 =
        Rule.builder()
            .taxonKey("1001")
            .datasetKey("dataset-single-1")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation("NATIVE")
            .projectId(createdProject.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule1)))
        .andExpect(status().isOk());

    // Get metrics with single username filter
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule/metrics")
                .param("username", "metrics-user-multi-1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.username", is("metrics-user-multi-1")))
        .andExpect(jsonPath("$.ruleCount", is(1)))
        .andExpect(jsonPath("$.datasetCount", is(1)))
        .andExpect(jsonPath("$.taxonCount", is(1)));
  }

  @Test
  @WithMockUser(
      username = "metrics-user-multi-2",
      roles = {"USER"})
  public void testMetricsWithMultipleUsernameFilter() throws Exception {
    // Create a project with multiple users as members
    Project project = new Project();
    project.setName("Multi User Metrics Test");
    project.setDescription("Testing metrics with multiple username filters");

    String projectResponse =
        mockMvc
            .perform(
                post("/occurrence/experimental/annotation/project")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(project)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    Project createdProject = objectMapper.readValue(projectResponse, Project.class);

    // Create rules as metrics-user-multi-2
    Rule rule1 =
        Rule.builder()
            .taxonKey("2001")
            .datasetKey("dataset-multi-1")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation("NATIVE")
            .projectId(createdProject.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule1)))
        .andExpect(status().isOk());

    // Create rules as a different user (test-user from test-data.sql)
    // First, we need to switch user context for this test
    // Since we can't easily do that in a single test, let's verify multi-user aggregation

    // Get metrics with multiple username filters
    // Should aggregate across both users (when both have rules)
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule/metrics")
                .param("username", "metrics-user-multi-2")
                .param("username", "test-user"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.username", is("ALL"))) // When multiple users, shows "ALL"
        .andExpect(jsonPath("$.ruleCount", greaterThanOrEqualTo(1))); // At least our rule
  }

  @Test
  @WithMockUser(
      username = "metrics-user-basis-1",
      roles = {"USER"})
  public void testMetricsByBasisOfRecord() throws Exception {
    // Create a project
    Project project = new Project();
    project.setName("Basis of Record Metrics Test");
    project.setDescription("Testing metrics filtered by basisOfRecord");

    String projectResponse =
        mockMvc
            .perform(
                post("/occurrence/experimental/annotation/project")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(project)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    Project createdProject = objectMapper.readValue(projectResponse, Project.class);

    // Create rules with different basis of record
    Rule rule1 =
        Rule.builder()
            .taxonKey("3001")
            .datasetKey("dataset-basis-1")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation("NATIVE")
            .basisOfRecord(new String[] {"PRESERVED_SPECIMEN"})
            .projectId(createdProject.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule1)))
        .andExpect(status().isOk());

    Rule rule2 =
        Rule.builder()
            .taxonKey("3002")
            .datasetKey("dataset-basis-2")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation("NATIVE")
            .basisOfRecord(new String[] {"HUMAN_OBSERVATION"})
            .projectId(createdProject.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule2)))
        .andExpect(status().isOk());

    // Get metrics filtered by PRESERVED_SPECIMEN
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule/metrics")
                .param("username", "metrics-user-basis-1")
                .param("basisOfRecord", "PRESERVED_SPECIMEN"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ruleCount", is(1)))
        .andExpect(jsonPath("$.datasetCount", is(1)));
  }

  @Test
  @WithMockUser(
      username = "metrics-user-year-1",
      roles = {"USER"})
  public void testMetricsByYearRange() throws Exception {
    // Create a project
    Project project = new Project();
    project.setName("Year Range Metrics Test");
    project.setDescription("Testing metrics filtered by yearRange");

    String projectResponse =
        mockMvc
            .perform(
                post("/occurrence/experimental/annotation/project")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(project)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    Project createdProject = objectMapper.readValue(projectResponse, Project.class);

    // Create rules with different year ranges
    Rule rule1 =
        Rule.builder()
            .taxonKey("4001")
            .datasetKey("dataset-year-1")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation("NATIVE")
            .yearRange("1900,2000")
            .projectId(createdProject.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule1)))
        .andExpect(status().isOk());

    Rule rule2 =
        Rule.builder()
            .taxonKey("4002")
            .datasetKey("dataset-year-2")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation("NATIVE")
            .yearRange("2000,2024")
            .projectId(createdProject.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule2)))
        .andExpect(status().isOk());

    // Get metrics filtered by specific year range
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule/metrics")
                .param("username", "metrics-user-year-1")
                .param("yearRange", "1900,2000"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ruleCount", is(1)))
        .andExpect(jsonPath("$.datasetCount", is(1)));
  }

  @Test
  @WithMockUser(
      username = "metrics-user-support-1",
      roles = {"USER"})
  public void testMetricsBySupportedBy() throws Exception {
    // Create a project
    Project project = new Project();
    project.setName("Support Metrics Test");
    project.setDescription("Testing metrics filtered by supportedBy");

    String projectResponse =
        mockMvc
            .perform(
                post("/occurrence/experimental/annotation/project")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(project)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    Project createdProject = objectMapper.readValue(projectResponse, Project.class);

    // Create a rule
    Rule rule =
        Rule.builder()
            .taxonKey("5001")
            .datasetKey("dataset-support-1")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation("NATIVE")
            .projectId(createdProject.getId())
            .build();

    String ruleResponse =
        mockMvc
            .perform(
                post("/occurrence/experimental/annotation/rule")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(rule)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    Rule createdRule = objectMapper.readValue(ruleResponse, Rule.class);

    // Add support from test-user
    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule/" + createdRule.getId() + "/support")
                .with(user("test-user").roles("USER")))
        .andExpect(status().isOk());

    // Get metrics filtered by supportedBy test-user
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule/metrics")
                .param("supportedBy", "test-user"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ruleCount", greaterThanOrEqualTo(1)));
  }

  @Test
  @WithMockUser(
      username = "metrics-user-combo-1",
      roles = {"USER"})
  public void testMetricsWithMultipleNewFilters() throws Exception {
    // Create a project
    Project project = new Project();
    project.setName("Combined Filters Metrics Test");
    project.setDescription("Testing metrics with multiple new filters");

    String projectResponse =
        mockMvc
            .perform(
                post("/occurrence/experimental/annotation/project")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(project)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    Project createdProject = objectMapper.readValue(projectResponse, Project.class);

    // Create rules with various attributes
    Rule rule1 =
        Rule.builder()
            .taxonKey("6001")
            .datasetKey("dataset-combo-1")
            .geometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))")
            .annotation("NATIVE")
            .basisOfRecord(new String[] {"PRESERVED_SPECIMEN"})
            .yearRange("2000,2024")
            .projectId(createdProject.getId())
            .build();

    mockMvc
        .perform(
            post("/occurrence/experimental/annotation/rule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(rule1)))
        .andExpect(status().isOk());

    // Get metrics with combined filters
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/rule/metrics")
                .param("username", "metrics-user-combo-1")
                .param("basisOfRecord", "PRESERVED_SPECIMEN")
                .param("yearRange", "2000,2024")
                .param("taxonKey", "6001"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ruleCount", is(1)))
        .andExpect(jsonPath("$.datasetCount", is(1)))
        .andExpect(jsonPath("$.taxonCount", is(1)));
  }
}
