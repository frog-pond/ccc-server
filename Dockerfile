FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS runtime
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
