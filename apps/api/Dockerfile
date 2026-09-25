# --- Dependencies stage (needs build tools for native modules like bcrypt) ---
FROM node:22.13-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev

# --- Runtime stage ---
FROM node:22.13-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 4000

CMD ["node", "server.js"]
