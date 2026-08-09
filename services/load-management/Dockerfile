# Use Node.js 18 as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Copy TypeScript config
COPY tsconfig.json ./

# Build TypeScript to JavaScript
RUN npm run build

# Expose port (if needed for health checks or metrics)
EXPOSE 3001

# Run the application
CMD ["node", "dist/index.js"]