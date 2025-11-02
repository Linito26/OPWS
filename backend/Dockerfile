# --------- build stage ---------
    FROM node:20-alpine AS build
    WORKDIR /app
    
    # pnpm (usa Corepack)
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
    COPY entrypoint.sh /entrypoint.sh
    RUN chmod +x /entrypoint.sh
    ENTRYPOINT ["/entrypoint.sh"]
    
    # utilidades mínimas (para esperar a la DB)
    RUN apk add --no-cache bash netcat-openbsd
    
    ENV NODE_ENV=production
    ENV PORT=2002
    EXPOSE 2002
    
    # Copiamos artefactos
    COPY --from=build /app/node_modules ./node_modules
    COPY --from=build /app/dist ./dist
    COPY --from=build /app/prisma ./prisma
    COPY package.json ./
    COPY entrypoint.sh /entrypoint.sh
    RUN chmod +x /entrypoint.sh
    
    CMD ["/entrypoint.sh"]
    