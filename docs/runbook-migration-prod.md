# Runbook: Migración de base de datos en producción

## Prerrequisitos

- Acceso SSH al servidor o acceso a la consola del host (Fly.io, Railway, Render…)
- Variables de entorno `DATABASE_URL` disponibles
- `pnpm` instalado en el entorno de despliegue, o Docker image con el backend compilado

---

## Pasos

### 1. Backup previo

```bash
# Con pg_dump (preferido si tienes acceso directo a Postgres)
pg_dump "$DATABASE_URL" -Fc -f backup_$(date +%Y%m%d_%H%M%S).dump

# Verificar que el backup es válido
pg_restore --list backup_*.dump | head -20
```

Guarda el backup en un lugar externo (S3, local) antes de continuar.

### 2. Verificar el estado actual de migraciones

```bash
# Muestra qué migraciones ya están aplicadas
pnpm --filter @football-gm/backend db:migrate --dry-run 2>/dev/null \
  || psql "$DATABASE_URL" -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at;"
```

### 3. Aplicar migraciones

```bash
# En el servidor / CI:
pnpm --filter @football-gm/backend db:migrate
```

Si usas Docker, ejecuta el migration step como entrypoint antes de levantar el servidor:

```dockerfile
CMD ["sh", "-c", "node dist/migrate.js && node dist/main.js"]
```

### 4. Verificar post-migración

```bash
# Comprobar que las tablas esperadas existen
psql "$DATABASE_URL" -c "\dt"

# Comprobar indexes en tablas críticas
psql "$DATABASE_URL" -c "\di+ players*"
psql "$DATABASE_URL" -c "\di+ trajectories*"

# Smoke test: la app responde
curl -f https://your-api-domain/health || echo "FAIL"
```

### 5. Rollback

Drizzle no genera rollbacks automáticos. Si la migración falla a mitad:

```bash
# Restaurar desde el backup tomado en el paso 1
pg_restore -d "$DATABASE_URL" --clean --if-exists backup_*.dump
```

Para indexes (operaciones idempotentes y sin pérdida de datos), puede eliminarse manualmente:

```sql
DROP INDEX CONCURRENTLY IF EXISTS "norms_game_tipo_uq";
DROP INDEX CONCURRENTLY IF EXISTS "players_game_idx";
-- etc.
```

---

## Índices añadidos en migración 0011

| Index | Tabla | Columnas | Tipo |
|-------|-------|----------|------|
| `awards_player_idx` | `awards` | `player_id` | btree |
| `norms_game_tipo_uq` | `norms` | `game_id, tipo` | unique btree |
| `players_game_idx` | `players` | `game_id` | btree |
| `sanctions_team_idx` | `sanctions` | `team_id` | btree |
| `trajectories_game_idx` | `trajectories` | `game_id` | btree |

Todos son `CREATE INDEX` sin bloqueo de escritura en Postgres 16 con `CONCURRENTLY` — seguro en producción con carga.

---

## Notas para Fly.io / Railway

- Fly.io: usar `fly ssh console` + `pnpm db:migrate` desde dentro del contenedor, o añadir un release command en `fly.toml`:
  ```toml
  [deploy]
    release_command = "pnpm --filter @football-gm/backend db:migrate"
  ```
- Railway: añadir un `Start Command` previo o usar el plugin de migrations.
- Render: usar el campo "Pre-deploy Command" en el servicio.
