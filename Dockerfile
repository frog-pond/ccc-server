FROM node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS runtime
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
