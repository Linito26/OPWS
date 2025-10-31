#!/usr/bin/env sh
set -e

# Defaults seguros
: "${PORT:=2002}"      # <-- API siempre en 2002 si no se especifica otro
: "${DB_HOST:=db}"
: "${DB_PORT:=5432}"

echo "Esperando a Postgres en ${DB_HOST}:${DB_PORT} ..."
i=0
until nc -z "${DB_HOST}" "${DB_PORT}"; do
  i=$((i+1))
  if [ "$i" -gt 60 ]; then
    echo "Timeout esperando a Postgres"
    exit 1
  fi
  sleep 1
done
echo "Postgres disponible."

echo "Aplicando migraciones..."
npx prisma migrate deploy || true

echo "Iniciando API con node dist/index.js ..."
echo "OPWS API en http://localhost:${PORT}"
exec node dist/index.js
