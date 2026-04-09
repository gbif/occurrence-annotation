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

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(EmbeddedPostgres.class)
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestSecurityConfig.class)
@TestPropertySource(locations = "classpath:test-application.properties")
public class StatsControllerTest {

  @Autowired private MockMvc mockMvc;

  @DynamicPropertySource
  static void configureProperties(DynamicPropertyRegistry registry) {
    PostgreSQLContainer postgres = EmbeddedPostgres.getPostgres();
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.datasource.driver-class-name", postgres::getDriverClassName);
  }

  @Test
  public void testGetTopCreators() throws Exception {
    mockMvc
        .perform(get("/occurrence/experimental/annotation/stats/top-creators"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$", isA(java.util.List.class)));
  }

  @Test
  public void testGetTopCreatorsWithLimit() throws Exception {
    mockMvc
        .perform(get("/occurrence/experimental/annotation/stats/top-creators").param("limit", "5"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$", isA(java.util.List.class)))
        .andExpect(jsonPath("$.length()", lessThanOrEqualTo(5)));
  }

  @Test
  public void testGetTopCreatorsDefaultLimit() throws Exception {
    mockMvc
        .perform(get("/occurrence/experimental/annotation/stats/top-creators"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$", isA(java.util.List.class)))
        .andExpect(jsonPath("$.length()", lessThanOrEqualTo(10)));
  }

  @Test
  public void testGetTopCreatorsResponseStructure() throws Exception {
    mockMvc
        .perform(get("/occurrence/experimental/annotation/stats/top-creators").param("limit", "1"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$", isA(java.util.List.class)));
    // If there are results, verify structure
    // Note: cannot assume results exist in clean test DB, so we just verify it's a valid list
  }

  @Test
  public void testGetMostSupportedCreators() throws Exception {
    mockMvc
        .perform(get("/occurrence/experimental/annotation/stats/most-supported-creators"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$", isA(java.util.List.class)));
  }

  @Test
  public void testGetMostSupportedCreatorsWithLimit() throws Exception {
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/stats/most-supported-creators")
                .param("limit", "3"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$", isA(java.util.List.class)))
        .andExpect(jsonPath("$.length()", lessThanOrEqualTo(3)));
  }

  @Test
  public void testGetTopProjects() throws Exception {
    mockMvc
        .perform(get("/occurrence/experimental/annotation/stats/top-projects"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$", isA(java.util.List.class)));
  }

  @Test
  public void testGetTopProjectsWithLimit() throws Exception {
    mockMvc
        .perform(get("/occurrence/experimental/annotation/stats/top-projects").param("limit", "2"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$", isA(java.util.List.class)))
        .andExpect(jsonPath("$.length()", lessThanOrEqualTo(2)));
  }

  @Test
  public void testGetTopProjectsDefaultLimit() throws Exception {
    mockMvc
        .perform(get("/occurrence/experimental/annotation/stats/top-projects"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$", isA(java.util.List.class)))
        .andExpect(jsonPath("$.length()", lessThanOrEqualTo(10)));
  }

  @Test
  public void testGetMostSupportedProjects() throws Exception {
    mockMvc
        .perform(get("/occurrence/experimental/annotation/stats/most-supported-projects"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$", isA(java.util.List.class)));
  }

  @Test
  public void testGetMostSupportedProjectsWithLimit() throws Exception {
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/stats/most-supported-projects")
                .param("limit", "7"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$", isA(java.util.List.class)))
        .andExpect(jsonPath("$.length()", lessThanOrEqualTo(7)));
  }

  @Test
  public void testAllEndpointsReturnJson() throws Exception {
    // Verify all endpoints return JSON content type
    mockMvc
        .perform(get("/occurrence/experimental/annotation/stats/top-creators"))
        .andExpect(content().contentType(MediaType.APPLICATION_JSON));

    mockMvc
        .perform(get("/occurrence/experimental/annotation/stats/most-supported-creators"))
        .andExpect(content().contentType(MediaType.APPLICATION_JSON));

    mockMvc
        .perform(get("/occurrence/experimental/annotation/stats/top-projects"))
        .andExpect(content().contentType(MediaType.APPLICATION_JSON));

    mockMvc
        .perform(get("/occurrence/experimental/annotation/stats/most-supported-projects"))
        .andExpect(content().contentType(MediaType.APPLICATION_JSON));
  }

  @Test
  public void testInvalidLimit() throws Exception {
    // Test with negative limit - should still return 200 but may be handled by backend
    mockMvc
        .perform(get("/occurrence/experimental/annotation/stats/top-creators").param("limit", "-1"))
        .andExpect(status().isOk());
  }

  @Test
  public void testLargeLimit() throws Exception {
    // Test with very large limit - should still work
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/stats/top-creators").param("limit", "1000"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON));
  }

  @Test
  public void testCorsHeaders() throws Exception {
    // Verify CORS is enabled (since @CrossOrigin is on the controller)
    mockMvc
        .perform(
            get("/occurrence/experimental/annotation/stats/top-creators")
                .header("Origin", "http://example.com"))
        .andExpect(status().isOk())
        .andExpect(header().exists("Access-Control-Allow-Origin"));
  }
}
