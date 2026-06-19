<div align="center">

# ⚽ Football GM

**Eres el comisionado, no el entrenador.**

Un simulador de gestión de ligas de fútbol inspirado en *Total Extreme Wrestling*.
No diriges un club ni a un jugador: diriges **una competición** y la conviertes,
temporada a temporada, en una liga de talla mundial.

[Bucle de juego](#-el-bucle-de-juego) ·
[Cómo se juega](#-cómo-se-juega) ·
[Arranque rápido](#-arranque-rápido) ·
[Arquitectura](#-arquitectura) ·
[Roadmap](#-roadmap)

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
| 🏁 **Pretemporada** | Sorteo de jornadas, firma de patrocinios y derechos, definición de premios y reparto. |
| ⚽ **Temporada** | Simulas jornadas. Ves resultados, goleadores, tarjetas. Resuelves conflictos y aplicas sanciones o impulsos. |
| 📊 **Cierre** | Se calcula la clasificación final, ascensos y descensos. Se escribe el registro histórico (inmutable). |
| 🏗️ **Revisión estructural** | Decides si expandes, abres una división o lanzas un torneo. Avanzan las negociaciones de adhesión. |

---

## 🎮 Cómo se juega

- **Prestigio y niveles (1–5).** El prestigio es tu puntuación principal; el nivel decide a qué clubes
  puedes acercarte. Una federación de nivel 4 no puede negociar con clubes de nivel 1.
- **Negociación de adhesión.** Tiene su propio ciclo: chequeo de nivel → recopilación de requisitos
  (1–2 años) → oferta y aceptación → efectiva **dos años después**. Hasta 5 años en total.
- **Impulsos.** Acciones limitadas por temporada para «poner el pulgar en la balanza» de un partido concreto.
- **Frenos al efecto bola de nieve.** Retardo de adhesión de dos años, barrera de nivel, *arraigo* de los
  equipos a su federación actual, tensión financiera (los ingresos comerciales deben escalar con el tamaño
  de la liga) y federaciones rivales reactivas.
- **Historia append-only.** Registros de temporada, trayectorias y palmarés se escriben una vez al cierre
  y nunca se mutan. Las vistas derivadas (clasificaciones, máximos goleadores, premios) se calculan a partir
  de esos registros.

El motor de simulación ya cubre: partidos, clasificaciones, copas y torneos, eventos y polémicas, economía,
salarios y tope salarial, traspasos, premios y reparto, normas y sanciones, premios individuales, y
negociaciones — todo determinista y reproducible por *seed*.

---

## 🚀 Arranque rápido

**Requisitos:** Node ≥ 22, [pnpm](https://pnpm.io/), y Docker (para Postgres).

```bash
# 1. Instalar dependencias
pnpm install

# 2. Levantar la base de datos (Postgres 16 en el puerto 5544)
docker compose up -d

# 3. Aplicar las migraciones
pnpm --filter @football-gm/backend db:migrate

# 4. Arrancar todo (backend, frontend y los watchers de engine/contracts)
pnpm dev
```

Luego abre **http://localhost:5290** en el navegador. ¡A jugar!

| Servicio  | URL                    | Notas |
|-----------|------------------------|-------|
| 🖥️ Frontend | http://localhost:5290 | **La app** — ábrela aquí |
| 🔌 Backend  | http://localhost:3000 | Solo API, rutas bajo `/games/...` |
| 🐘 Postgres | localhost:5544        | Docker (`5544:5432` para no chocar con un Postgres local) |

<details>
<summary>Variables de entorno</summary>

- `apps/backend/.env` → `DATABASE_URL` (puerto 5544) y `PORT` (3000). Plantilla en `.env.example`.
- `apps/frontend/.env.local` → `VITE_API_URL` (por defecto `http://localhost:3000`). Plantilla en `.env.example`.

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
```

---

## 🏛️ Arquitectura

Monorepo **pnpm + Turborepo**:

```
apps/
  backend       @football-gm/backend     NestJS — shell imperativo: persistencia + API HTTP
  frontend      @football-gm/frontend     React + Vite — UI de solo datos
packages/
  engine        @football-gm/engine       núcleo de simulación puro, determinista y seedeado (sin I/O)
  contracts     @football-gm/contracts    esquemas zod + DTOs inferidos (contrato back/front)
  config        @football-gm/config       tsconfig / eslint / prettier compartidos
```

**Stack:** NestJS · Drizzle ORM · PostgreSQL · React · Vite · Zod · TypeScript en todo.

La lógica de juego vive en `@football-gm/engine` (puro, sin framework ni base de datos, corre en Node y en
el navegador). El backend es solo la cáscara que persiste y expone la API. `@football-gm/contracts` es la
única fuente de verdad del contrato entre back y front.

### Modelo de entidades

```
Federación  →  Liga  →  División  →  Equipo  →  Jugador
Federación  →  Copa / Torneo
Temporada   →  Jornada  →  Partido (2 equipos)
```

Decisiones de modelado clave:

- **La federación es un solo tipo de entidad** — la tuya y las rivales comparten modelo, distinguidas por un
  flag `is_player`.
- **Nada se borra en duro** — un equipo que deja una liga cambia de federación, nunca se elimina (preserva la historia).
- **La historia es append-only** — se escribe una vez al cierre de temporada y nunca se muta.

---

## 🗺️ Roadmap

- [x] **Esquema de datos** — modelo de entidades traducido a tablas
- [x] **Bucle mínimo** — simular una temporada y producir una clasificación
- [x] **Sistemas de comisionado** — prestigio, niveles, negociación, frenos, federaciones reactivas
- [x] **Capa de historia** — tablas append-only + vistas derivadas (palmarés, goleadores, premios)
- [ ] **Pulido** — más realismo en el motor, eventos y polémicas
- [ ] **Fase 3 (futuro)** — servicio en Python para detección de patrones narrativos; crónicas de temporada generadas por LLM

El diseño completo está en [`diseno-simulador-liga.md`](./diseno-simulador-liga.md) (español).

---

<div align="center">
<sub>Construido como simulador de gestión de competiciones, no de clubes. Tú eres el comisionado.</sub>
</div>
