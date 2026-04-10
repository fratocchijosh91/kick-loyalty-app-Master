FROM node:18-alpine

WORKDIR /app

# Force cache refresh - timestamp: $(date)
ARG CACHE_BUST=2026-04-10-1500

# Copy backend package files
COPY backend/package*.json ./

# Install dependencies (force fresh install)
RUN npm cache clean --force && npm install --production

# Copy backend source
COPY backend/ ./

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start
CMD ["npm", "start"]
# Force rebuild
# Cache refresh Fri Apr 10 14:59:37 CEST 2026
