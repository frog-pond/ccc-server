FROM node:22-alpine

RUN apk add -U curl

WORKDIR /app
COPY ./package.json ./package-lock.json ./

RUN npm ci --omit=dev

HEALTHCHECK --interval=20s --timeout=1s \
  CMD curl -f http://localhost:80/ping

COPY ./source ./source

ENV NODE_ENV=production
ENV NODE_PORT=80
ENV INSTITUTION=unknown

CMD node -r dotenv/config ./source/ccc-server/index.js
