FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4173 \
    DATA_DIR=/data

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY server.mjs ./
COPY lib ./lib
COPY public ./public
COPY scripts ./scripts

RUN mkdir -p /data && chown -R node:node /app /data
USER node

EXPOSE 4173
VOLUME ["/data"]
CMD ["npm", "start"]
