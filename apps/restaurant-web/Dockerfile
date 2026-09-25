# --- Build stage ---
FROM node:22.13-alpine AS build
WORKDIR /app
COPY packages/web-ui/ ./packages/web-ui/
COPY apps/restaurant-web/package*.json ./apps/restaurant-web/
WORKDIR /app/apps/restaurant-web
RUN npm ci
COPY apps/restaurant-web/ /app/apps/restaurant-web/
RUN npm run build

# --- Serve stage ---
FROM nginx:alpine
COPY --from=build /app/apps/restaurant-web/dist /usr/share/nginx/html
COPY apps/restaurant-web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
