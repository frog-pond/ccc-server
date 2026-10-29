FROM node:24.22.2-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS runtime
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
