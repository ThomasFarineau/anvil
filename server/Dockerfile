# anvil-server — hébergement des mods/configs + comptes utilisateurs
# Build :  docker build -t anvil-server .
# Run   :  docker compose up -d   (voir docker-compose.yml)

FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
RUN bun run build:ui

FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    MONGO_URL=mongodb://mongo:27017/anvil \
    ANVIL_ADMIN_USERNAME=admin \
    ANVIL_ADMIN_PASSWORD=admin

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/ui/dist ./ui/dist

VOLUME /data
EXPOSE 8080
CMD ["bun", "src/index.ts"]
