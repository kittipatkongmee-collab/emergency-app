FROM node:22-trixie-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openjdk-21-jre-headless \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/packages/firebase-rules-tests
COPY packages/firebase-rules-tests/package.json ./
RUN npm install --ignore-scripts

COPY packages/firebase-rules-tests/ ./
COPY apps/api-php/firebase/database.rules.json /workspace/apps/api-php/firebase/database.rules.json

CMD ["npm", "test"]
