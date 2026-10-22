FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS runtime
WORKDIR /app

RUN apk add -U curl

COPY --link ./package.json ./package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

COPY --link ./source ./source

ENV NODE_ENV=production
ENV NODE_PORT=80
ENV INSTITUTION=unknown

HEALTHCHECK --interval=20s --timeout=1s \
  CMD curl -f http://localhost:80/ping

CMD ["node", "./source/ccc-server/index.ts"]
