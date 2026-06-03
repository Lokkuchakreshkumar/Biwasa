# 1. Base Image with Node.js
FROM node:20-bookworm-slim

# 2. Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PORT=5173
EXPOSE 5173

# 3. Install Python, pip, venv, and system libraries required for browser execution
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    wget \
    gnupg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 4. Set working directory
WORKDIR /app

# 5. Copy package files and install Next.js/Node dependencies
COPY package*.json ./
RUN npm ci

# 6. Setup Python virtual environment and install Scrapling & Playwright
RUN python3 -m venv venv
RUN ./venv/bin/pip install --upgrade pip
RUN ./venv/bin/pip install "scrapling[fetchers]"

# 7. Install Playwright browser dependencies and Chromium
RUN npx playwright install-deps chromium
RUN ./venv/bin/scrapling install

# 8. Copy the rest of the application files
COPY . .

# 9. Build the Next.js production bundle
RUN npm run build

# 10. Start server on Next.js port

# 11. Command to start the application
CMD ["npm", "run", "start"]
