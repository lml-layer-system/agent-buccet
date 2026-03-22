FROM oven/bun:1 AS base
WORKDIR /app

# Copy only the server source — no node_modules needed, zero deps.
COPY server/witness/index.ts ./index.ts

# Create data directory for the checkpoint log.
RUN mkdir -p data

# Non-root user for production.
RUN addgroup --system buccet && adduser --system --ingroup buccet buccet
RUN chown -R buccet:buccet /app
USER buccet

ENV PORT=3000
ENV WITNESS_LOG_PATH=/app/data/checkpoints.jsonl

EXPOSE 3000

# Mount /app/data as a volume in production to persist the checkpoint log.
VOLUME ["/app/data"]

CMD ["bun", "run", "index.ts"]
