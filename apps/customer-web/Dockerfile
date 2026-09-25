# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY user/package*.json ./user/
WORKDIR /app/user
RUN npm ci
COPY shared/ /app/shared/
COPY user/ /app/user/
RUN npm run build

# --- Serve stage ---
FROM nginx:alpine
COPY --from=build /app/user/dist /usr/share/nginx/html
COPY user/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
