# Use Node.js 18 Alpine
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only — keeps image lean
RUN npm ci --omit=dev --legacy-peer-deps

# Copy the full source
COPY . .

# Create non-root user and assign ownership
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

ENV NODE_ENV=production

# Cloud Run expects container to listen on $PORT
EXPOSE 8080

CMD ["node", "server.js"]
