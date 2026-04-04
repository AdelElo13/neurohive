FROM node:18-slim

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY dist/ ./dist/
COPY bin/ ./bin/

ENV NODE_ENV=production

ENTRYPOINT ["node", "dist/index.js"]
