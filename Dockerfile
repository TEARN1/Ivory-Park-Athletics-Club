FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/lib/relay.ts src/lib/relay.ts
COPY server server
ENV PORT=8787 DATA_FILE=/data/db.json
VOLUME /data
EXPOSE 8787
USER node
CMD ["npx", "tsx", "server/index.ts"]
