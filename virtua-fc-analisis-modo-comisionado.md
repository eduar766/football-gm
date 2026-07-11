# VirtuaFC como referencia para un juego de fútbol en modo comisionado

Análisis de arquitectura y diseño de VirtuaFC (Laravel/PHP) enfocado en qué patrones de gameplay, motor de simulación y automatización son trasladables a un juego centrado en modo comisionado, construido en un monorepo TypeScript.

## 1. El bucle jugable — por qué es rejugable

VirtuaFC no tiene "una partida", tiene **carreras de manager multi-temporada** con memoria persistente: la habilidad de un jugador nunca es un número fijo, es la salida de una tubería `market_value → ability → age adjustment → potential oculto → desarrollo anual → nuevo market_value`. Eso genera historias distintas cada vez porque:

- **El potencial es oculto y con incertidumbre**: el usuario ve un rango scouteado, no el valor real. Apostar por una promesa es una decisión con riesgo real, no una lectura de spreadsheet.
- **La progresión es una curva de un solo eje por edad** (`DevelopmentCurve::AGE_CURVES`) con bonos por minutos jugados y por "gap de calidad" — así que decisiones de rotación real (quién juega) afectan quién se convierte en crack.
- **Los bucles económicos y deportivos se retroalimentan**: reputación ↔ ingresos ↔ presupuesto de fichajes ↔ resultados ↔ reputación. Esto es lo que hace que cada partida "se sienta viva" sin scripting manual de eventos.

**Para un modo comisionado**: la rejugabilidad no viene del contenido, viene de que el estado del mundo es una función continua y determinista-con-ruido de decisiones pasadas. Si tu juego solo simula temporadas, necesitas exactamente este tipo de tuberías (valor↔habilidad↔edad↔potencial) para que años de liga simulada produzcan narrativas coherentes en vez de ruido puro.

## 2. El motor de simulación de partidos — barato, paramétrico, no basado en eventos "ricos" por defecto

Un comisionado necesita simular cientos de partidos por vuelta sin coste computacional ni de diseño insostenible. VirtuaFC ya resuelve esto con tres niveles de fidelidad sobre el mismo kernel matemático:

- `MatchOutcomeModel::expectedGoals()` — kernel único: xG por **diferencia** de fuerza (no ratio, evita normalizar por liga).
- `MatchSimulator` → partido "completo": eventos, tarjetas, lesiones, asistencias, posición de gol.
- `AIMatchResolver` → resolución liviana para IA.
- `SyntheticLeagueResolver` → el nivel más barato: resuelve ligas que el usuario nunca abre mediante Poisson independiente por partido, **sin generar `MatchEvent`, alineación, MVP ni comentario** — solo marcador y tabla. Es, de hecho, un prototipo de "modo comisionado" ya dentro de VirtuaFC, aplicado hoy solo a las ligas que el jugador no controla.

Detalles de diseño relevantes:

- Se resuelve **de forma perezosa** ("lazy"): no simula nada hasta que alguien mira esa liga (o hasta el cierre de temporada, vía `FinalizeOtherLeaguesProcessor`).
- Usa un **advisory lock de Postgres** por `(game_id, competition_id)` para que peticiones concurrentes no dupliquen el sorteo de fixtures — importante si un comisionado corre temporadas para cientos de ligas a la vez.
- Los tres niveles de fidelidad comparten el mismo kernel matemático: el nivel de detalle es una decisión de *qué envoltura llamas*, no de reimplementar la física del partido.

**Lección de diseño**: separa siempre el "kernel de resultado" (puramente matemático, sin efectos secundarios, testeable con inputs/outputs) de los "envoltorios" que deciden cuánto detalle generar. Un modo comisionado full necesita ese kernel barato como *default*, y el envoltorio rico solo para los partidos que el usuario realmente observa.

## 3. La capa de automatización — el mundo sigue sin ti

VirtuaFC tiene, para los equipos que el usuario no controla, un ecosistema completo de IA heurística — reglas deterministas con ruido controlado, no ML.

| Sistema | Qué decide la IA | Servicio |
|---|---|---|
| Táctica | Formación ajustada a la plantilla, mentalidad según reputación (tier "audaz/medio/cauto") × local/visitante × fuerza relativa, rotación por fatiga | `AITacticsService`, `LineupService::autoSelectLineup` |
| Mercado | Fichajes IA-IA en dos fases: "limpieza de plantilla" (65%, venden a clubs igual/menor reputación) y "mejora de talento" (35%, venden a clubs igual/mayor reputación, priorizando 22-28 años) | `AITransferMarketService` |
| Contratos | Renovación automática de expirados, aceptación de pre-contratos con "ambición" (penaliza clubs de baja reputación fichando estrellas) | `ContractService` |
| Reputación | Tier dinámico con regresión hacia la base — evita inflación descontrolada y premia sostenibilidad, no un pico puntual | `ReputationUpdateProcessor` |
| Fidelidad de afición | Deriva de resultados (títulos, ascensos, escándalos) con suelo anti-colapso (`base_loyalty − 15`) | `FanLoyaltyUpdateProcessor` |
| Ligas no vistas | Resolución Poisson perezosa (ver sección 2) | `SyntheticLeagueResolver` |

Lo interesante arquitectónicamente: **cada decisión de usuario tiene un heurístico IA espejo** (principio de diseño explícito: "AI parity"). No construyeron "el juego para el usuario" y luego un parche de IA — diseñaron cada sistema para que *cualquier* equipo (humano o no) pueda tomar esa decisión con la misma función, solo cambiando el input (heurístico vs. input de usuario).

**Aplicación directa a modo comisionado**: en ese caso *todos* los equipos son "IA" salvo las intervenciones puntuales del comisionado (reglas, sanciones, ajustes). Diseñar cada sistema (fichajes, tácticas, presupuesto, contratos) como una función `decidir(equipo, contexto) → acción` con dos implementaciones intercambiables (heurística vs. override humano) da gratis:

- Simulación de ligas enteras sin intervención.
- Un punto de inyección limpio para cuando el comisionado sí quiere intervenir (vetar un fichaje, forzar una regla).
- Testabilidad: el heurístico de IA de fichajes se puede testear de forma aislada, como ya hace `AITransferMarketService`.

## 4. La arquitectura que lo sostiene — patrones, no tecnología PHP

Los patrones son agnósticos de lenguaje y se trasladan directamente a un monorepo TS:

**a) Pipeline de procesadores ordenados con `priority()`.** El cierre/apertura de temporada no es una función monolítica: son 17 + 7 clases pequeñas, cada una implementando `SeasonProcessor`, ejecutadas por prioridad numérica. Añadir un sistema nuevo (p. ej. patrocinios) es crear una clase nueva y darle un número — cero cambios al código existente. En TS: un array de objetos `{priority, name, run(ctx)}` ordenado y ejecutado en serie.

**b) Un DTO único con "metadata bag" en vez de crecer el modelo.** `SeasonTransitionData` viaja por toda la tubería y lleva una bolsa de claves (`META_UCL_WINNER`, etc.) para que un procesador publique datos que otro consume más adelante, sin acoplar sus tipos. Evita el problema de "el DTO de temporada tiene 80 campos opcionales". En TS: un objeto de contexto tipado con un `Map<string, unknown>` o un registro de claves conocidas.

**c) Eventos síncronos como costura entre módulos.** Laravel dispara eventos *síncronamente* (no colas) para cosas como `MatchFinalized` o `CupTieResolved`, y listeners independientes reaccionan (actualizar tabla, notificar, generar la siguiente ronda de copa). Los módulos nunca se llaman entre sí directamente para reglas de negocio — se comunican por eventos. Replicable en TS con un `EventEmitter` tipado o similar.

**d) Separación estricta motor matemático vs. orquestador.** `MatchOutcomeModel` (puro, sin IO) vs. `MatchdayOrchestrator` (transaccional, con locks de fila, maneja concurrencia). El kernel se testea con asserts numéricos; el orquestador se testea con flujos de escenario. Mezclarlos impide testear el motor de simulación sin levantar toda la infraestructura de partida.

**e) Handlers intercambiables por tipo de competición.** `CompetitionHandler` (interfaz con 4 métodos: `getMatchBatch`, `beforeMatches`, `afterMatches`, `getRedirectRoute`) resuelto dinámicamente por `handler_type`. Liga, copa, formato suizo, playoff y mundial son la misma interfaz con implementaciones distintas — strategy pattern limpio, ideal si el comisionado soporta múltiples formatos de competición.

## 5. Deuda técnica real ya documentada (para no repetirla)

VirtuaFC documenta honestamente su propia deuda de diseño en el sistema de avance de jornada:

1. **Generación de rondas inconsistente** — un handler genera su siguiente ronda vía listener de evento, otros la generan internamente en su propio `beforeMatches()`. Mezclar ambos estilos obliga a hardcodear excepciones ("este listener se salta estos dos tipos").
2. **Llamadas redundantes** — el mismo `beforeMatches()` se invoca 2-3 veces por ciclo desde distintos puntos, y solo funciona porque cada handler implementa su propio guard de idempotencia.
3. **Lógica de resolución de eliminatorias duplicada** casi textual en 4 handlers distintos, en vez de extraída a un servicio compartido.

**Recomendación**: define un único punto de entrada y un único mecanismo (evento *o* llamada directa, no ambos) para "avanzar el mundo", y pon la idempotencia en el orquestador central, no repartida por cada implementación.

## Resumen aplicado al modo comisionado

Lo más transferible de VirtuaFC no es el manager estándar en sí — es que ya construyeron, como submódulo interno, **un motor de comisionado** (`SyntheticLeagueResolver` + `AITransferMarketService` + `AITacticsService` + reputación/fidelidad dinámicas) para todo lo que el jugador no toca directamente. La estrategia consiste en promover ese submódulo a producto principal: mismo kernel de resultado barato, mismos heurísticos "AI parity" por sistema, pero corriendo para *todos* los equipos, con el comisionado como capa de intervención puntual (reglas, sanciones, vetos) en vez de como manager de un único club.
