# -------- build vite --------
    FROM node:20-alpine AS build
    WORKDIR /app
    RUN corepack enable && corepack prepare pnpm@9.7.1 --activate
    
    COPY pnpm-lock.yaml package.json ./
    RUN pnpm install --frozen-lockfile
    
    # Por defecto, el frontend usará /api (proxy en nginx)
    ARG VITE_API_URL=/api
    ENV VITE_API_URL=$VITE_API_URL
    
    COPY . .
    RUN pnpm build
    
    # -------- nginx runtime ------
    FROM nginx:1.27-alpine
    WORKDIR /usr/share/nginx/html
    COPY --from=build /app/dist ./
    COPY nginx.conf /etc/nginx/conf.d/default.conf
    EXPOSE 80
    CMD ["nginx", "-g", "daemon off;"]
    