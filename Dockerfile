FROM docker.io/node:11-alpine

RUN apk add -U curl

WORKDIR /app
ADD ./package.json /app
ADD ./yarn.lock /app

RUN yarn install --production

HEALTHCHECK --interval=20s --timeout=1s \
  CMD curl -f http://localhost:80/ping

ADD . /app

ENV NODE_ENV=production
ENV NODE_PORT=80
ENV INSTITUTION=unknown

CMD node -r esm -r dotenv/config ./modules/node_modules/@frogpond/ccc-server/index.js
