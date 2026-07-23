FROM node:22-bookworm-slim AS client-build

WORKDIR /app/client

COPY tractor-game-simulator/client/package.json tractor-game-simulator/client/package-lock.json ./
RUN npm ci

COPY tractor-game-simulator/client/ ./
RUN npm run build


FROM node:22-bookworm-slim AS runtime

ARG WHODESIGNED_COMMIT=d02e0d6786fba365c73ac784b449fc028d1c1293

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY tractor-game-simulator/server/package.json tractor-game-simulator/server/package-lock.json ./tractor-game-simulator/server/
RUN cd tractor-game-simulator/server && npm ci --omit=dev

COPY tractor-game-simulator/server/ ./tractor-game-simulator/server/
COPY simple-bot/ ./simple-bot/
COPY --from=client-build /app/client/dist ./tractor-game-simulator/client/dist/

RUN git clone https://github.com/Roushelfy/WhoDesigned.git ./WhoDesigned \
  && git -C ./WhoDesigned checkout --detach "${WHODESIGNED_COMMIT}" \
  && rm -rf ./WhoDesigned/.git

ENV NODE_ENV=production
ENV PYTHON_BIN=python3

WORKDIR /app/tractor-game-simulator/server

EXPOSE 5000

CMD ["node", "src/index.js"]
