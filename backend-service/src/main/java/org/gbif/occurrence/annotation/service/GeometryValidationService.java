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
package org.gbif.occurrence.annotation.service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

/**
 * Service for validating geometry size limits to prevent abuse of the annotation system. Enforces
 * limits on polygon vertex count and WKT string length.
 */
@Service
public class GeometryValidationService {

  private static final int MAX_POLYGON_VERTICES = 2500;
  private static final int MAX_WKT_LENGTH = 125000;

  // Pattern to match coordinate pairs in WKT (e.g., "1.23 4.56")
  // Matches decimal numbers (with optional sign and decimal point) followed by space and another
  // number
  private static final Pattern COORDINATE_PAIR_PATTERN =
      Pattern.compile("-?\\d+(?:\\.\\d+)?\\s+-?\\d+(?:\\.\\d+)?");

  /**
   * Validates that a WKT geometry string does not exceed size limits.
   *
   * @param wkt the WKT geometry string to validate
   * @param isAdmin whether the current user is an administrator (admins bypass the limit)
   * @throws IllegalArgumentException if the geometry exceeds size limits and user is not an admin
   */
  public void validateGeometry(String wkt, boolean isAdmin) {
    if (wkt == null || wkt.isBlank()) {
      throw new IllegalArgumentException("Geometry is required");
    }

    // Admins can bypass size limits for special cases (e.g., ocean boundaries)
    if (isAdmin) {
      return;
    }

    // Check WKT string length first (fast check)
    if (wkt.length() > MAX_WKT_LENGTH) {
      throw new IllegalArgumentException(
          "WKT geometry exceeds maximum length of "
              + MAX_WKT_LENGTH
              + " characters (found "
              + wkt.length()
              + " characters)");
    }

    // Count vertices in the geometry
    int vertexCount = countVertices(wkt);
    if (vertexCount > MAX_POLYGON_VERTICES) {
      throw new IllegalArgumentException(
          "Polygon exceeds maximum of "
              + MAX_POLYGON_VERTICES
              + " vertices (found "
              + vertexCount
              + " vertices)");
    }
  }

  /**
   * Counts the number of vertices (coordinate pairs) in a WKT geometry string. Handles both POLYGON
   * and MULTIPOLYGON formats.
   *
   * @param wkt the WKT geometry string
   * @return the number of coordinate pairs
   */
  int countVertices(String wkt) {
    if (wkt == null || wkt.isBlank()) {
      return 0;
    }

    int count = 0;
    Matcher matcher = COORDINATE_PAIR_PATTERN.matcher(wkt);

    while (matcher.find()) {
      count++;
    }

    return count;
  }

  /**
   * Gets the maximum allowed vertices for non-admin users.
   *
   * @return the maximum vertex count
   */
  public int getMaxVertices() {
    return MAX_POLYGON_VERTICES;
  }
}
