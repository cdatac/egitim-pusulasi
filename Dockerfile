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
COPY scripts/doctor.mjs scripts/launch.mjs ./scripts/

RUN mkdir -p /data && chown -R node:node /app /data
USER node

EXPOSE 4173
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4173/api/health').then(response => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"
CMD ["npm", "start"]
