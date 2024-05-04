FROM node:22-alpine

RUN apk add -U curl

WORKDIR /app
COPY ./package.json ./package-lock.json ./

RUN npm ci --omit=dev

HEALTHCHECK --interval=20s --timeout=1s \
  CMD curl -f http://localhost:80/ping

COPY . ./

ENV NODE_ENV=production
ENV NODE_PORT=80
ENV INSTITUTION=unknown

CMD node -r dotenv/config ./modules/node_modules/@frogpond/ccc-server/index.js
