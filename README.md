<div align="center">

# ⚽ Football GM

**Eres el comisionado, no el entrenador.**

Un simulador de gestión de ligas de fútbol inspirado en *Total Extreme Wrestling*.
No diriges un club ni a un jugador: diriges **una competición** y la conviertes,
temporada a temporada, en una liga de talla mundial.

[Bucle de juego](#-el-bucle-de-juego) ·
[Cómo se juega](#-cómo-se-juega) ·
[Arranque rápido](#-arranque-rápido) ·
[Arquitectura](#-arquitectura)

</div>

---

## 💡 La idea

Empiezas con una liga modesta de 10 equipos. Simulas jornadas rápido, resuelves los pocos
conflictos que surjan, y al cerrar cada temporada gestionas lo comercial y la estructura de la
competición. Tu liga gana o pierde **prestigio**, y el prestigio determina a qué clubes puedes
aspirar para que se unan a ti.

La interfaz es de **solo datos** —tablas, listas y números, sin motor 3D— y la simulación es veloz.
El placer central es avanzar jornadas con fluidez y ver crecer un proyecto deportivo.

> **Principio no negociable:** los equipos son autónomos. Fichan, eligen entrenador, estilo y cantera
> por su cuenta. Tú los consultas y validas que cumplan las normas. En cuanto pudieras fichar por un
> club, el juego dejaría de ser lo que es y se convertiría en otro Football Manager.

---

## 🔁 El bucle de juego

> Simulas jornadas → revisas resultados y conflictos → aplicas sanciones o gastas un impulso →
> al cerrar la temporada gestionas lo comercial y la estructura → la liga gana o pierde prestigio →
> el prestigio determina a qué equipos puedes aspirar.

Una temporada de principio a fin:

| Fase | Qué pasa |
|------|----------|
| 🏁 **Pretemporada** | Sorteo de jornadas, firma de patrocinios y derechos, definición de premios y reparto. Se genera el mandato de la junta. |
| ⚽ **Temporada** | Simulas jornadas. Ves resultados, goleadores, tarjetas. Resuelves conflictos, aplicas sanciones o impulsos. |
| 📊 **Cierre** | Clasificación final, ascensos y descensos. Se evalúa el mandato de la junta. Se escribe el registro histórico (inmutable). |
| 🏗️ **Revisión estructural** | Decides si expandes, abres una división o lanzas un torneo. Avanzan las negociaciones de adhesión. |

---

## 🎮 Cómo se juega

- **Prestigio y niveles (1–5).** El prestigio es tu puntuación principal; el nivel decide a qué clubes
  puedes acercarte. Una federación de nivel 4 no puede negociar con clubes de nivel 1.
- **Negociación de adhesión.** Tiene su propio ciclo: chequeo de nivel → recopilación de requisitos
  (1–3 años, un requisito revelado por temporada) → oferta (con % de reparto comprometido) → aceptación
  → efectiva **dos años después**. La aceptación requiere que el 75% de los requisitos revelados estén
  cumplidos. Hasta 5 años en total.
- **Mandatos de la junta.** Cada temporada la junta emite un objetivo (prestige, equipos, ingresos...).
  Dos mandatos fallidos consecutivos reducen tus impulsos disponibles.
- **Impulsos.** Acciones limitadas por temporada para «poner el pulgar en la balanza» de un partido concreto.
  También puedes gastar uno en una revisión VAR (máx 2/temporada, cuesta −1 prestige).
- **Normas de gobernanza.** Crear normas que los clubes cumplen da +1/+2 prestige al cierre de temporada.
- **Frenos al efecto bola de nieve.** Retardo de adhesión de dos años, barrera de nivel, *arraigo* de los
  equipos a su federación actual, tensión financiera y federaciones rivales reactivas.
- **Rivales con agencia.** Las federaciones rivales invierten en sus equipos débiles, responden cuando les
  robas un club, negocian entre sí, y mantienen su reputación como un valor inercial separado de su fuerza.
- **Narrativa emergente.** Al cerrar cada temporada se generan titulares (rachas, sorpresas, goleadas) y
  una crónica de temporada (campeón, revelación, decepción, mejor jugador).
- **Historia append-only.** Registros de temporada, trayectorias y palmarés se escriben una vez al cierre
  y nunca se mutan. El libro de récords (mayor goleada, racha más larga) y el ranking mundial de federaciones
  se acumulan automáticamente.

---

## 🚀 Arranque rápido

**Requisitos:** Node ≥ 22, [pnpm](https://pnpm.io/), y Docker (para Postgres).

```bash
# 1. Instalar dependencias
pnpm install

# 2. Levantar la base de datos (Postgres 16 en el puerto 5544)
docker compose up -d

# 3. Configurar variables de entorno del backend
cp apps/backend/.env.example apps/backend/.env
# Edita apps/backend/.env y pon:
#   JWT_SECRET=<cadena aleatoria ≥ 32 chars>
#   ADMIN_EMAIL=<tu email>
#   ADMIN_PASSWORD=<contraseña inicial>

# 4. Aplicar las migraciones
pnpm --filter @football-gm/backend db:migrate

# 5. Arrancar todo (backend, frontend y los watchers de engine/contracts)
pnpm dev
```

Luego abre **http://localhost:5290** en el navegador, inicia sesión con las credenciales de admin y empieza a jugar.

| Servicio  | URL                    | Notas |
|-----------|------------------------|-------|
| 🖥️ Frontend | http://localhost:5290 | **La app** — ábrela aquí |
| 🔌 Backend  | http://localhost:3000 | API bajo `/games/...`, `/auth/...`, `/admin/...` |
| 🐘 Postgres | localhost:5544        | Docker (`5544:5432` para no chocar con un Postgres local) |

<details>
<summary>Variables de entorno del backend</summary>

Copia `apps/backend/.env.example` a `apps/backend/.env` y rellena:

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | Sí | `postgresql://postgres:postgres@localhost:5544/football_gm` |
| `JWT_SECRET` | Sí | Cadena aleatoria ≥ 32 chars (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `ADMIN_EMAIL` | Sí | Email de la cuenta admin inicial |
| `ADMIN_PASSWORD` | Sí | Contraseña de la cuenta admin inicial |
| `RESEND_API_KEY` | No | Emails transaccionales (reset de contraseña). Sin esta clave los emails se loguean en consola (modo dry-run) |
| `APP_URL` / `FRONTEND_ORIGIN` | No | Por defecto `http://localhost:5290` |

El frontend solo necesita `VITE_API_URL` en `apps/frontend/.env.local` (por defecto `http://localhost:3000`).

</details>

---

## 🛠️ Comandos

```bash
pnpm dev          # turbo: build de engine+contracts y watch de todas las apps
pnpm build        # build de producción de todo el monorepo
pnpm typecheck    # comprobación de tipos
pnpm test         # tests (engine usa vitest + fast-check)
pnpm lint         # ESLint

# Base de datos (drizzle-kit)
pnpm --filter @football-gm/backend db:generate   # generar migración desde cambios de esquema
pnpm --filter @football-gm/backend db:migrate    # aplicar migraciones

# Ejecutar un test concreto
pnpm --filter @football-gm/engine test -- test/golden.test.ts
pnpm --filter @football-gm/engine test -- test/golden.test.ts --update  # actualizar snapshot
```

---

## 🏛️ Arquitectura

Monorepo **pnpm + Turborepo**:

```
apps/
  backend       @football-gm/backend     NestJS — shell imperativo: persistencia + API HTTP
  frontend      @football-gm/frontend    React + Vite — UI de solo datos (Mantine + TanStack Router/Query)
packages/
  engine        @football-gm/engine      núcleo de simulación puro, determinista y seedeado (sin I/O)
  contracts     @football-gm/contracts   esquemas Zod + DTOs inferidos (contrato back/front)
  config        @football-gm/config      tsconfig / eslint / prettier compartidos
```

**Stack:** NestJS · Drizzle ORM · PostgreSQL 16 · React · Vite · Mantine · TanStack Router/Query · Recharts · Zod · TypeScript en todo.

La lógica de juego vive en `@football-gm/engine` (puro, sin framework ni base de datos). El backend es la cáscara que persiste y expone la API. `@football-gm/contracts` es la única fuente de verdad del contrato entre back y front.

### Modelo de datos

```
Confederation  →  Federation  →  Division  →  Team  →  Player
Federation     →  Cup / Tournament
Season         →  Matchday    →  Match (2 teams)
```

- `GameState` se serializa como JSONB en `game_engine_states` — es el modelo de escritura autoritativo.
- Las tablas relacionales (`teams`, `federations`, `season_records`, `trajectories`, etc.) son proyecciones de lectura/historial, escritas al cerrar la temporada. Nunca son fuente de verdad.
- La federación del jugador y las rivales comparten el mismo modelo; distinguidas por el flag `isPlayer`.
- Nada se borra en duro; la historia es append-only.
- Tres RNGs independientes: `state.rng` (motor de partidos), `state.rivalRng` (ligas rivales), `state.mandatesRng` (mandatos de la junta). **Nunca se mezclan.**

### Sistemas implementados

| Sistema | Descripción |
|---------|-------------|
| Motor de partidos | Goles Poisson, tarjetas, goleadores, reportes por jornada |
| Economía | Contratos comerciales, merchandise, reparto de derechos, tope salarial |
| Negociación de adhesión | Requisitos revelados por temporada, oferta con % de reparto, cooldown de rechazo |
| Normas y sanciones | 6 tipos de norma, `governanceBonus` por cumplimiento |
| Copas | Eliminatoria simple / ida y vuelta / liga, copas recurrentes con participantes editables |
| Rivalidades | Detección automática desde trayectorias (posiciones contiguas N temporadas) |
| Rivales | Ligas internas completas, 132 equipos UEFA reales, inversión, represalia selectiva, negociaciones entre rivales |
| Mandatos de la junta | Objetivo por temporada, fail-state acumulativo |
| Narrativa | Titulares por temporada, crónica de cierre |
| Historial | Libro de récords, trayectorias con gráfico, ranking mundial de federaciones |
| Autenticación | JWT, registro por solicitud de acceso, reset de contraseña, panel de admin |
| Export/Import | Save game como JSON descargable/importable |
| Migraciones de estado | `migrateState()` actualiza saves antiguos al esquema actual automáticamente |

---

<div align="center">
<sub>Construido como simulador de gestión de competiciones, no de clubes. Tú eres el comisionado.</sub>
</div>
