# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY admin/package*.json ./admin/
WORKDIR /app/admin
RUN npm ci
COPY shared/ /app/shared/
COPY admin/ /app/admin/
RUN npm run build

# --- Serve stage ---
FROM nginx:alpine
COPY --from=build /app/admin/dist /usr/share/nginx/html
COPY admin/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
