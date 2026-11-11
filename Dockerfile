FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/lib src/lib
COPY server server
ENV PORT=8787 DATA_FILE=/data/db.json
# the server runs as the unprivileged `node` user, so it must own its data folder
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 8787
USER node
CMD ["npx", "tsx", "server/index.ts"]
