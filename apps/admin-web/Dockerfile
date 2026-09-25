# --- Build stage ---
FROM node:22.13-alpine AS build
WORKDIR /app
COPY packages/web-ui/ ./packages/web-ui/
COPY apps/admin-web/package*.json ./apps/admin-web/
WORKDIR /app/apps/admin-web
RUN npm ci
COPY apps/admin-web/ /app/apps/admin-web/
RUN npm run build

# --- Serve stage ---
FROM nginx:alpine
COPY --from=build /app/apps/admin-web/dist /usr/share/nginx/html
COPY apps/admin-web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
