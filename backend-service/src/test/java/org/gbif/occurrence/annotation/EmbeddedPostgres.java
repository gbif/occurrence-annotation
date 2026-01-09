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

import org.junit.jupiter.api.extension.AfterAllCallback;
import org.junit.jupiter.api.extension.BeforeAllCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.testcontainers.containers.PostgreSQLContainer;

public class EmbeddedPostgres implements BeforeAllCallback, AfterAllCallback {
  @SuppressWarnings("resource")
  private static final PostgreSQLContainer<?> postgres =
      new PostgreSQLContainer<>("postgres:17.2")
          .withDatabaseName("annotations")
          .withInitScript("test-init.sql");

  @Override
  public void beforeAll(ExtensionContext context) {
    postgres.start();
  }

  @Override
  public void afterAll(ExtensionContext context) {
    postgres.stop();
  }

  @SuppressWarnings("rawtypes")
  public static PostgreSQLContainer getPostgres() {
    return postgres;
  }
}
