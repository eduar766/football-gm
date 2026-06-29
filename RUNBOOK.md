# RUNBOOK — Producción

## Migraciones de base de datos

### Antes de migrar

```bash
# 1. Backup completo
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Verificar que el backup es válido
pg_restore -l backup_*.sql | head -20
```

### Ejecutar migración

```bash
# Aplicar migraciones pendientes
pnpm --filter @football-gm/backend db:migrate
```

### Verificar

```bash
# Confirmar que las tablas existen y tienen las columnas esperadas
psql "$DATABASE_URL" -c "\d games"
psql "$DATABASE_URL" -c "SELECT count(*) FROM game_engine_states;"
```

### Rollback manual (si falla)

```bash
# Restaurar desde el backup más reciente
psql "$DATABASE_URL" < backup_YYYYMMDD_HHMMSS.sql
```

### Notas

- `db:migrate` usa `drizzle-kit migrate` que aplica migraciones pendientes en orden.
- Las migraciones son idempotentes — ejecutarlas múltiples veces es seguro.
- Para migraciones de índices en tablas con muchos datos, considerar `CREATE INDEX CONCURRENTLY` (requiere separar la migración en archivos SQL manuales).
- Nunca borrar una migración ya aplicada — crear una nueva migración que revierta el cambio si es necesario.
