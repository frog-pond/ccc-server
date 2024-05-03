FROM docker.io/node:18-alpine

RUN apk add -U curl g++ make python3

WORKDIR /app
COPY ./package.json ./package-lock.json /app

RUN npm ci --production

HEALTHCHECK --interval=20s --timeout=1s \
  CMD curl -f http://localhost:80/ping

ADD . /app

ENV NODE_ENV=production
ENV NODE_PORT=80
ENV INSTITUTION=unknown

CMD node -r esm -r dotenv/config ./modules/node_modules/@frogpond/ccc-server/index.js
