#!/bin/sh
set -e

: "${PORT:=2002}"
: "${DB_HOST:=db}"
: "${DB_PORT:=5432}"

echo "Esperando Postgres en ${DB_HOST}:${DB_PORT}..."
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

echo "DATABASE_URL (parcial): $(echo "${DATABASE_URL}" | sed 's#://.*:@#://****:****@#')"

echo "Aplicando migraciones..."
./node_modules/.bin/prisma migrate deploy

echo "Iniciando API en puerto ${PORT}..."
exec node dist/index.js
