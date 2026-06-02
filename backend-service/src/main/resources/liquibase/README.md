# Database changelog (Liquibase-style)

Ordered, human-maintained schema history for the occurrence-annotation PostgreSQL
database.

These files are a **change log**. The Spring Boot app does not run Liquibase at
startup (the dependency is test-scoped), so nothing is applied to real databases
automatically. Integration tests rebuild the schema from these files via Liquibase,
and the R-package CI applies them with `mvn liquibase:update`.

## Layout

```
liquibase/
├── master.xml                               # ordered <include> of every changelog
├── schema.sql                               # baseline schema, loaded by 001-initial.xml
├── 001-initial.xml                          # <sqlFile> -> schema.sql
└── 00N-short-description.xml                # one changeSet with inline <sql> per change
```

## Adding a schema change

1. Create `00N-short-description.xml` (next number) with a single `<changeSet>`:

   ```xml
   <changeSet id="N" author="you">
     <comment>What and why.</comment>
     <sql splitStatements="false" stripComments="false">
       <![CDATA[
         ALTER TABLE ... ;
       ]]>
     </sql>
   </changeSet>
   ```

2. Register it in [`master.xml`](master.xml) with
   `<include file="liquibase/00N-short-description.xml"/>` (keep order).

That is enough: integration tests rebuild the schema from `master.xml` (then load
test fixtures), and the R-package CI runs `mvn liquibase:update`. Do **not** edit
`schema.sql` for routine changes; it is the frozen baseline as of changelog adoption.

## Applying to a database

Liquibase applies the baseline plus every registered changelog, in order:

```bash
mvn -f backend-service/pom.xml liquibase:update \
  -Dliquibase.url=jdbc:postgresql://localhost:5432/annotation \
  -Dliquibase.username=postgres \
  -Dliquibase.password=password
```

The `liquibase-maven-plugin` is configured with `changeLogFile=liquibase/master.xml`
in `pom.xml`. It is not bound to any build phase, so it only runs when invoked
explicitly (the application never runs Liquibase on its own).

Legacy one-off scripts under `src/main/resources/` (`add_custom_vocabulary_column.sql`,
`migrate_basis_of_record_to_array.sql`) are historical; new work goes here.
