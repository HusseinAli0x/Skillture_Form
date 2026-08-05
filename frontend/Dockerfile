# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
# npm ci installs exactly what package-lock.json pins, so the image matches CI.
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:1.27-alpine
# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Add nginx config to support React Router SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
