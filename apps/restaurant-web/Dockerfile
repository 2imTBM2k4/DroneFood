# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY restaurant/package*.json ./restaurant/
WORKDIR /app/restaurant
RUN npm ci
COPY shared/ /app/shared/
COPY restaurant/ /app/restaurant/
RUN npm run build

# --- Serve stage ---
FROM nginx:alpine
COPY --from=build /app/restaurant/dist /usr/share/nginx/html
COPY restaurant/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
