# Use Node.js 20 LTS
FROM node:20-slim

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (will compile better-sqlite3)
RUN npm install --omit=dev

# Copy app source
COPY . .

# Create data directory
RUN mkdir -p /tmp/meitzad-data

# Expose port
EXPOSE 10000

# Set environment
ENV NODE_ENV=production
ENV PORT=10000

# Start the app
CMD ["npm", "start"]
