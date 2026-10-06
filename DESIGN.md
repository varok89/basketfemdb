# DESIGN.md — basketfemdb

Sistema de diseño vinculante para la app y para cualquier agente de IA (Claude Code, Codex, Cursor) que la toque. Si una decisión no está aquí, consulta antes de inventar.

**Fuente de verdad en código**: `src/styles/app.css` (`:root` + `html[data-bfdb-tema="dark"]`). Este fichero describe el porqué y las reglas de uso; los valores se cambian en `app.css`.

**Tono**: medio de baloncesto femenino. Datos primero, limpio, con acento morado como marca. No es LinkedIn ni Notion — es periódico deportivo con cariño por la estadística.

---

## 1. Paleta

### Tokens base (light / dark)

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--fx-bg` | `#f1f5f9` | `#0f172a` | Fondo de página |
| `--fx-card` | `#fff` | `#1e293b` | Superficie elevada (cards, modales) |
| `--fx-hover` | `#f8fafc` | `#1a2434` | Hover sobre superficies |
| `--fx-text` | `#1e293b` | `#f1f5f9` | Texto principal |
| `--fx-muted` | `#64748b` | `#94a3b8` | Texto secundario |
| `--fx-muted2` | `#94a3b8` | `#64748b` | Texto terciario (metadata) |
| `--fx-label` | `#475569` | `#cbd5e1` | Etiquetas de formulario |
| `--fx-border` | `#e2e8f0` | `#334155` | Border estándar |
| `--fx-border2` | `#f1f5f9` | `#1e293b` | Border sutil / divider |
| `--fx-brand` | `#9333ea` | `#c084fc` | Morado marca |
| `--fx-brand2` | `#c084fc` | `#9333ea` | Morado secundario |
| `--fx-shadow` | `0 1px 6px rgba(0,0,0,.07)` | `0 1px 6px rgba(0,0,0,.4)` | Elevación card |
| `--fx-shadow-hover` | `0 4px 16px rgba(147,51,234,.15)` | `0 4px 16px rgba(147,51,234,.35)` | Hover (siempre tinte morado) |

### Acentos semánticos

Cinco familias con `{bg, border, text}` por familia. **Usar siempre la familia completa, nunca un hex suelto.**

| Familia | Significado | Ejemplos |
|---|---|---|
| `--fx-amber-*` | Aviso, "ojo con esto" | Pendientes, warnings de calidad |
| `--fx-red-*` | Error, destructivo | Fallos, borrados, partido en directo |
| `--fx-green-*` | Éxito, OK | Victorias, datos verificados |
| `--fx-blue-*` | Info, neutro frío | FIBA, selecciones, info |
| `--fx-lila-*` | Marca sutil | Chips de "nuevo", destacados suaves |

Amber tiene además `--fx-amber-hover` y `--fx-amber-hover-border` (único con interacción propia).

### Regla #1 — Nada de hex inline

Prohibido en JSX salvo:
- Colores de bandera (CDN externo, no son UI).
- Colores de equipo/liga (dato real, no estilo).
- Shadows específicos de animación (`partidoPulse` ya está en CSS).

Si lo que quieres pintar no tiene token, el fallo está en el inventario: añade un token nuevo a `app.css`, no un hex en el componente.

---

## 2. Elevación y superficies

Tres niveles, no más:

1. **Base** — `--fx-bg`. La página.
2. **Card** — `--fx-card` con `box-shadow: var(--fx-shadow)` y `border-radius: 12px`. El bloque de contenido estándar.
3. **Modal** — `--fx-card` con `box-shadow: var(--fx-shadow-hover)` o superior y `border-radius: 16px`. Sobre backdrop oscuro.

Hover de card eleva con `--fx-shadow-hover` (siempre tinte morado — es parte de la identidad, no un plano gris).

**Deuda conocida**: 163 cards duplican estilo inline. Al tocar una, extraer a componente `Card` reutilizable; no multiplicar la deuda. Ver `Vault/conocimiento/refactor-patrones-app.md`.

---

## 3. Tipografía y escala

Font-family hereda del sistema (sin webfont custom en MVP — veloz y neutro).

| Elemento | Mobile | Desktop | Peso |
|---|---|---|---|
| Título vista | 20px | 24px | 700 |
| Título card | 16px | 18px | 600 |
| Body | 14px | 15px | 400 |
| Metadata | 12px | 13px | 500 |
| Badge/chip | 10px | 12px | 600 |

Mobile breakpoint único: **640px** (ver reglas `@media (max-width: 640px)` en `app.css`). Diseñar siempre pensando en mobile primero — es donde se consume el 70% de @labasketneta.

---

## 4. Espaciado

Múltiplos de 4px. Patrones repetidos:

- Padding interno card: `16px` (desktop), `10px` (mobile).
- Gap entre cards: `12px`.
- Gap entre chips: `6px` (desktop), `3px` (mobile).
- Padding de chip: `4px 8px` (desktop), `2px 5px` (mobile).

---

## 5. Componentes clave

### Card
`background: var(--fx-card)` + `border: 1px solid var(--fx-border)` + `border-radius: 12px` + `box-shadow: var(--fx-shadow)` + `padding: 16px`. Mobile baja padding a 10px.

### Chip / Pill
Componente `Chip` con `CHIP_STYLES` mapa por variante (ya en App.jsx top-level). Variantes alineadas a familias de acento: `amber | red | green | blue | lila | neutral`. **Añadir variante nueva implica añadir token**, no un hex.

### MedallaCard
Patrón unificado para logros. Usa `useId()` para SVG defs (evita colisiones al renderizar dos veces el mismo gradiente). Vive en `src/views/Medalla.jsx`.

### Modal
**Pendiente de unificar**. Objetivo: un único `Modal` shell reutilizable (actualmente hay uno en `App.jsx:542` pero cada vista reimplementa cabecera + botón ×). Al abordarlo, consolidar: padding, botón cerrar, backdrop, z-index. Hasta entonces, cualquier modal nuevo debe reusar el shell existente en `App.jsx`, no copiar inline.

### Toast / feedback
**Pendiente**. Hoy la app tiene 35+ `alert()`. Primer refactor UI prioritario. Diseño objetivo: toast en portal, top-right, auto-dismiss 4s, variantes `success | error | info` alineadas a tokens de acento.

---

## 6. Dark mode

- Activación: `html[data-bfdb-tema="dark"]`.
- Los tokens se redefinen automáticamente; **no hacer `useTheme()` ni ternarios de color en JSX** — es el token el que cambia.
- Imágenes transparentes (logos/escudos/fotos) reciben fondo blanco sutil automático vía CSS para no desaparecer. Excluir con `className="bfdb-flag-bg"` cuando sea bandera o similar que ya se pinta correctamente.
- Acentos en dark usan `rgba()` con opacidad baja + texto más vivo. No usar los mismos hex del light.

---

## 7. Accesibilidad (no-negociable)

- `focus-visible` global ya aplicado en `app.css`: outline 2px morado marca con offset 2px. **No sobrescribir sin outline alternativo visible.**
- Contraste mínimo WCAG AA en texto sobre superficie.
- Tocables mínimos 44x44px en mobile.
- `aria-label` en botones solo-icono (ej. 🏀, ×, 🔗).
- `sr-only` para texto de solo-lectores (clase ya definida en `app.css`).

---

## 8. Animación

Cuatro keyframes existen y son todo lo que debe haber. No sumar nuevos salvo necesidad clara:

- `bounce` — carga/éxito puntual.
- `shadow` — compañero de bounce.
- `bfdb-shimmer` — skeleton loader (`<div className="bfdb-skel">`).
- `partidoPulse` — rojo que respira para partido en directo.

Transiciones estándar: `transition: all 0.15s ease` (hover de card, chip, botón). Nada más lento salvo que haya una razón concreta.

---

## 9. Reglas para agentes de IA

Al editar UI en este proyecto:

1. **Leer `app.css` antes de pintar.** Si existe token, usarlo. Si no existe, abrir pregunta: "¿añadimos token X o reutilizamos Y?".
2. **Nunca introducir hex en JSX** salvo las excepciones del §1.
3. **Hooks antes de early returns.** Reventó RecordsEquipo en prod — todos los `useState/useEffect/useMemo` antes de cualquier `if () return null`.
4. **Un cambio visual nuevo = ¿tengo que tocar 5 sitios?** Si sí, estás creando `MedallaCard`/`Chip`/`Card` nuevo. Extráelo.
5. **Mobile first.** Probar siempre a `max-width: 640px`. El 70% de los usuarios públicos entran desde X/IG en el móvil.
6. **No añadir dependencias de UI.** Nada de MUI, Chakra, shadcn, Tailwind. El stack es inline + tokens CSS y así se queda hasta decisión explícita.

---

## 10. Anti-patrones conocidos (deuda)

Lista viva — ir tachando conforme se resuelva. Detalle en `Vault/conocimiento/refactor-patrones-app.md`.

- [ ] 163 cards blancas con inline style duplicado → componente `Card`.
- [ ] 35+ `alert()` → sistema de toast.
- [ ] Modal shell inconsistente → unificar.
- [ ] `TeamsView` / `PlayersView` / `PartidosView` siguen en App.jsx → extraer.
- [ ] Hex hardcoded en varios sitios → migrar a tokens.
- [ ] `LOTE_POR_TIPO` en CalidadModal → mapa en vez de switch.

---

## 11. Cómo evolucionar este fichero

- Cambios de token: PR que toca `app.css` **y** la tabla del §1 en el mismo commit.
- Componentes nuevos reutilizables: añadir sección en §5 cuando se extraigan.
- Deuda cerrada: marcar en §10 en el mismo PR que la cierre.

Este fichero manda sobre memorias de agente. Si una memoria contradice algo de aquí, actualizar la memoria.
