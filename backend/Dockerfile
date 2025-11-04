# --------- build stage ---------
    FROM node:20-alpine AS build
    WORKDIR /app
    
    # pnpm (Corepack)
    RUN corepack enable && corepack prepare pnpm@9.7.1 --activate
    
    # deps + prisma
    COPY pnpm-lock.yaml package.json ./
    COPY prisma ./prisma
    RUN pnpm install --frozen-lockfile
    RUN pnpm prisma:generate
    
    # código y build
    COPY tsconfig.json ./
    COPY src ./src
    RUN pnpm build
    
    # --------- runtime stage ---------
    FROM node:20-alpine AS runtime
    WORKDIR /app
    
    # Herramientas para healthcheck y esperar DB
    RUN apk add --no-cache curl netcat-openbsd
    
    ENV NODE_ENV=production
    ENV PORT=2002
    EXPOSE 2002
    
    # Artefactos del build
    COPY --from=build /app/node_modules ./node_modules
    COPY --from=build /app/dist ./dist
    COPY --from=build /app/prisma ./prisma
    COPY package.json ./
    COPY entrypoint.sh /entrypoint.sh
    
    # Normaliza CRLF -> LF y da permisos
    RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh
    
    ENTRYPOINT ["/entrypoint.sh"]
    