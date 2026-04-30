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

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class GeometryValidationServiceTest {

  private GeometryValidationService service;

  @BeforeEach
  public void setUp() {
    service = new GeometryValidationService();
  }

  @Test
  public void testValidSmallPolygon() {
    // Small polygon with 5 vertices - should pass
    String wkt = "POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))";

    assertDoesNotThrow(() -> service.validateGeometry(wkt, false));
    assertEquals(5, service.countVertices(wkt));
  }

  @Test
  public void testValidPolygonAtLimit() {
    // Generate a polygon with exactly 2500 vertices
    String wkt = generatePolygonWithVertices(2500);

    assertDoesNotThrow(() -> service.validateGeometry(wkt, false));
    assertEquals(2500, service.countVertices(wkt));
  }

  @Test
  public void testOversizedPolygonThrowsException() {
    // Generate a polygon with 2501 vertices (1 over the limit)
    String wkt = generatePolygonWithVertices(2501);

    IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> service.validateGeometry(wkt, false));

    assertTrue(exception.getMessage().contains("2500"));
    assertTrue(exception.getMessage().contains("2501"));
    assertEquals(2501, service.countVertices(wkt));
  }

  @Test
  public void testOversizedPolygonWithAdminBypass() {
    // Generate a polygon with 3000 vertices - should pass for admin
    String wkt = generatePolygonWithVertices(3000);

    assertDoesNotThrow(() -> service.validateGeometry(wkt, true));
    assertEquals(3000, service.countVertices(wkt));
  }

  @Test
  public void testExtremelyLongWktThrowsException() {
    // Generate a WKT string longer than MAX_WKT_LENGTH (125,000 characters)
    StringBuilder sb = new StringBuilder("POLYGON((");
    // Each coordinate pair is roughly "123.456 789.012, " = ~20 characters
    // Need ~6250 vertices to exceed 125,000 chars
    for (int i = 0; i < 6250; i++) {
      if (i > 0) {
        sb.append(", ");
      }
      sb.append(i).append(".123 ").append(i).append(".456");
    }
    sb.append("))");

    String wkt = sb.toString();
    assertTrue(wkt.length() > 125000, "WKT should exceed length limit");

    IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> service.validateGeometry(wkt, false));

    assertTrue(exception.getMessage().contains("125000"));
    assertTrue(exception.getMessage().contains("characters"));
  }

  @Test
  public void testMultiPolygonVertexCountSumsCorrectly() {
    // MULTIPOLYGON with two parts: first has 5 vertices, second has 6 vertices
    // Total should be 11 vertices
    String wkt = "MULTIPOLYGON(((0 0, 0 1, 1 1, 1 0, 0 0)), ((2 2, 2 3, 3 3, 3 2, 2 2, 2.5 2.5)))";

    assertDoesNotThrow(() -> service.validateGeometry(wkt, false));
    assertEquals(11, service.countVertices(wkt));
  }

  @Test
  public void testMalformedWktHandledGracefully() {
    // Malformed WKT should still be counted (validation happens elsewhere)
    String wkt = "POLYGON((0 0, 0 1, 1 1))"; // Not a closed polygon

    assertDoesNotThrow(() -> service.validateGeometry(wkt, false));
    assertEquals(3, service.countVertices(wkt));
  }

  @Test
  public void testNullWktThrowsException() {
    IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> service.validateGeometry(null, false));

    assertTrue(exception.getMessage().contains("required"));
  }

  @Test
  public void testBlankWktThrowsException() {
    IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> service.validateGeometry("   ", false));

    assertTrue(exception.getMessage().contains("required"));
  }

  @Test
  public void testPolygonWithHoles() {
    // Polygon with outer ring (5 vertices) and inner ring/hole (5 vertices)
    // Total: 10 vertices
    String wkt = "POLYGON((0 0, 0 10, 10 10, 10 0, 0 0), (2 2, 2 8, 8 8, 8 2, 2 2))";

    assertDoesNotThrow(() -> service.validateGeometry(wkt, false));
    assertEquals(10, service.countVertices(wkt));
  }

  @Test
  public void testPolygonWithNegativeCoordinates() {
    // Polygon with negative coordinates (valid for global geometries)
    String wkt = "POLYGON((-10.5 -20.3, -10.5 20.3, 10.5 20.3, 10.5 -20.3, -10.5 -20.3))";

    assertDoesNotThrow(() -> service.validateGeometry(wkt, false));
    assertEquals(5, service.countVertices(wkt));
  }

  /**
   * Helper method to generate a polygon WKT string with a specified number of vertices. Creates a
   * circular pattern of coordinates.
   */
  private String generatePolygonWithVertices(int vertexCount) {
    StringBuilder sb = new StringBuilder("POLYGON((");

    for (int i = 0; i < vertexCount; i++) {
      if (i > 0) {
        sb.append(", ");
      }
      // Generate coordinates in a circular pattern
      double angle = (2 * Math.PI * i) / (vertexCount - 1);
      double x = Math.cos(angle);
      double y = Math.sin(angle);
      sb.append(String.format("%.6f %.6f", x, y));
    }

    sb.append("))");
    return sb.toString();
  }
}
