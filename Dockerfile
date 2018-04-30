FROM docker.io/node:10-alpine

RUN apk add -U curl

WORKDIR /app
ADD ./package.json /app
ADD ./package-lock.json /app

RUN npm install --production

HEALTHCHECK --interval=20s --timeout=1s \
  CMD curl -f http://localhost:3001/ping

ADD . /app

ENV NODE_ENV=production
ENV NODE_PORT=3001
ENV INSTITUTION=unknown

CMD node --experimental-modules -r dotenv/config ./index.mjs
