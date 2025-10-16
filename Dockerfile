FROM node:22.20.0-alpine@sha256:cb3143549582cc5f74f26f0992cdef4a422b22128cb517f94173a5f910fa4ee7 AS node

FROM node AS modules_dev
WORKDIR /app

COPY --link ./package.json ./package-lock.json ./
RUN npm ci


FROM modules_dev AS modules
RUN npm ci --omit=dev


FROM modules_dev AS build
COPY --link tsconfig.json .
COPY --link ./source ./source
COPY --link ./types ./types
RUN npm run build


FROM node AS runtime
WORKDIR /app

RUN apk add -U curl

COPY --link ./package.json ./package-lock.json ./
COPY --link --from=modules /app/node_modules ./node_modules
COPY --link --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV NODE_PORT=80
ENV INSTITUTION=unknown

HEALTHCHECK --interval=20s --timeout=1s \
  CMD curl -f http://localhost:80/ping

CMD ["node", "./dist/source/ccc-server/index.js"]
