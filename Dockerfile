# Multi-stage Dockerfile for Smart CLI
# Builds frontend and backend in a single container

FROM node:20-alpine AS frontend-builder

# Build frontend
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS backend-builder

# Prepare backend dependencies
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install --production

FROM node:20-alpine

# Security: Create non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -S -u 1001 -G appuser appuser

WORKDIR /app

# Copy shared utilities
COPY shared/ ./shared/

# Copy backend
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY backend/package.json ./backend/
COPY backend/server.js ./backend/

# Copy frontend build
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Create necessary directories with proper permissions
RUN mkdir -p /app/sandbox /app/backend/data && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
WORKDIR /app/backend
CMD ["node", "server.js"]
