# ccc-server

cautious-computing-context: backend node caching server/proxy

## Getting Started

Prerequisites
- Node.js v20.17
- npm

Install

```sh
git clone https://github.com/frog-pond/ccc-server.git
cd ccc-server
npm install
```

## Running the Server

### Development

Watch mode (recommended): auto-recompile & restart on changes

```sh
npm run watch
```

Institution-specific servers

```sh
npm run stolaf-college
npm run carleton-college
```

### Production

```sh
npm run build
npm run start:prod
```

## Testing

All tests

```sh
npm run test
```

Smoke tests

```sh
npm run test:stolaf-college
npm run test:carleton-college
```
