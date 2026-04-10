package org.gbif.occurrence.annotation.typehandler;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.gbif.occurrence.annotation.model.VocabularyTerm;
import org.postgresql.util.PGobject;

/**
 * MyBatis TypeHandler for converting between VocabularyTerm[] and PostgreSQL JSONB.
 * Handles serialization/deserialization of custom vocabulary terms for project annotations.
 */
public class JsonbVocabularyTypeHandler extends BaseTypeHandler<VocabularyTerm[]> {

  private static final ObjectMapper objectMapper = new ObjectMapper();

  @Override
  public void setNonNullParameter(
      PreparedStatement ps, int i, VocabularyTerm[] parameter, JdbcType jdbcType)
      throws SQLException {
    try {
      PGobject jsonObject = new PGobject();
      jsonObject.setType("jsonb");
      jsonObject.setValue(objectMapper.writeValueAsString(parameter));
      ps.setObject(i, jsonObject);
    } catch (JsonProcessingException e) {
      throw new SQLException("Failed to serialize VocabularyTerm[] to JSONB", e);
    }
  }

  @Override
  public VocabularyTerm[] getNullableResult(ResultSet rs, String columnName) throws SQLException {
    return parseJsonb(rs.getString(columnName));
  }

  @Override
  public VocabularyTerm[] getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
    return parseJsonb(rs.getString(columnIndex));
  }

  @Override
  public VocabularyTerm[] getNullableResult(CallableStatement cs, int columnIndex)
      throws SQLException {
    return parseJsonb(cs.getString(columnIndex));
  }

  private VocabularyTerm[] parseJsonb(String json) throws SQLException {
    if (json == null || json.isEmpty()) {
      return null;
    }
    try {
      return objectMapper.readValue(json, VocabularyTerm[].class);
    } catch (JsonProcessingException e) {
      throw new SQLException("Failed to deserialize JSONB to VocabularyTerm[]", e);
    }
  }
}
