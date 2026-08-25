FROM node:22-alpine

WORKDIR /app
COPY --chown=node:node local ./local
COPY --chown=node:node public ./public

ENV NODE_ENV=production \
    PORT=8092 \
    BAMBUDDY_URL=http://127.0.0.1:8001

USER node
EXPOSE 8092
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1

CMD ["node", "local/server.mjs"]
