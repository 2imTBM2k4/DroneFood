# --- Build stage ---
FROM node:22.13-alpine AS build
WORKDIR /app
COPY packages/web-ui/ ./packages/web-ui/
COPY apps/customer-web/package*.json ./apps/customer-web/
WORKDIR /app/apps/customer-web
RUN npm ci
COPY apps/customer-web/ /app/apps/customer-web/
RUN npm run build

# --- Serve stage ---
FROM nginx:alpine
COPY --from=build /app/apps/customer-web/dist /usr/share/nginx/html
COPY apps/customer-web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
