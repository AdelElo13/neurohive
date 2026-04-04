FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY dist/ ./dist/
COPY bin/ ./bin/

EXPOSE 3000

ENTRYPOINT ["node", "dist/index.js"]
