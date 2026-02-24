FROM node:24-alpine

WORKDIR /app

# Install dependencies (copied first for layer caching)
COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
# Dummy DATABASE_URL for prisma generate (no DB connection during build)
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app"
RUN npm ci

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Dev: install deps (populate node_modules volume) then run
CMD ["sh", "-c", "npm ci && npm run start:dev"]
