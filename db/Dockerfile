FROM postgres:16-alpine

WORKDIR /db
COPY *.sql ./
COPY migrations/ ./migrations/
ENTRYPOINT ["psql", "-X", "--set", "ON_ERROR_STOP=1"]
CMD ["-f", "/db/migrate.sql"]
