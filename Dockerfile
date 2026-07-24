# Multi-stage Dockerfile for Cally Backend API (Bun + Express + Prisma)

FROM oven/bun:1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5001

# Copy package definition files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile || bun install

# Copy application source code and prisma schema
COPY . .

# Generate Prisma Client
RUN bunx prisma generate

EXPOSE 5001

CMD ["bun", "index.ts"]
