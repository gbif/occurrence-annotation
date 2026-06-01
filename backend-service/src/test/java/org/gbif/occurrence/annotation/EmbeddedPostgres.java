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
package org.gbif.occurrence.annotation;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

import org.junit.jupiter.api.extension.AfterAllCallback;
import org.junit.jupiter.api.extension.BeforeAllCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.testcontainers.postgresql.PostgreSQLContainer;

import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;

/**
 * Starts a PostgreSQL test container and builds its schema from the Liquibase changelog ({@code
 * liquibase/master.xml}), then loads test fixtures ({@code test-data.sql}).
 *
 * <p>The schema is therefore always in sync with the change log: adding a new changelog file and
 * registering it in {@code master.xml} is enough for tests to pick it up.
 */
public class EmbeddedPostgres implements BeforeAllCallback, AfterAllCallback {

  private static final String CHANGELOG = "liquibase/master.xml";
  private static final String TEST_DATA = "test-data.sql";

  @SuppressWarnings("resource")
  private static final PostgreSQLContainer postgres =
      new PostgreSQLContainer("postgres:17.2").withDatabaseName("annotations");

  @Override
  public void beforeAll(ExtensionContext context) {
    postgres.start();
    applyChangelog();
    loadTestData();
  }

  @Override
  public void afterAll(ExtensionContext context) {
    postgres.stop();
  }

  public static PostgreSQLContainer getPostgres() {
    return postgres;
  }

  private static Connection openConnection() throws Exception {
    return DriverManager.getConnection(
        postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
  }

  private static void applyChangelog() {
    try (Connection connection = openConnection()) {
      Database database =
          DatabaseFactory.getInstance()
              .findCorrectDatabaseImplementation(new JdbcConnection(connection));
      try (Liquibase liquibase =
          new Liquibase(CHANGELOG, new ClassLoaderResourceAccessor(), database)) {
        liquibase.update(new Contexts(), new LabelExpression());
      }
    } catch (Exception e) {
      throw new IllegalStateException("Failed to apply Liquibase changelog " + CHANGELOG, e);
    }
  }

  private static void loadTestData() {
    String sql = readClasspathResource(TEST_DATA);
    try (Connection connection = openConnection();
        Statement statement = connection.createStatement()) {
      statement.execute(sql);
    } catch (Exception e) {
      throw new IllegalStateException("Failed to load test data " + TEST_DATA, e);
    }
  }

  private static String readClasspathResource(String resource) {
    try (InputStream in = EmbeddedPostgres.class.getClassLoader().getResourceAsStream(resource)) {
      if (in == null) {
        throw new IllegalStateException("Missing classpath resource: " + resource);
      }
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    } catch (Exception e) {
      throw new IllegalStateException("Failed to read classpath resource " + resource, e);
    }
  }
}
