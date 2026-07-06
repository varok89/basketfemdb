"""
Actualiza resultados del FIBA U20 Women's EuroBasket 2026 en la tabla `partidos`.
Pensado para ejecutarse en GitHub Actions con cron. Sin IA, coste cero.

Variables de entorno necesarias:
  SUPABASE_URL          p.ej. https://qvtxqckuolacvnvrvysu.supabase.co
  SUPABASE_SERVICE_KEY  service_role key (secret de GitHub)
"""
import json
import os
import re
import sys
import urllib.request

FIBA_URL = "https://www.fiba.basketball/en/events/fiba-u20-womens-eurobasket-2026/games"
ID_LIGA = "L067"
TEMPORADA = "2026"

# Código FIBA -> id_equipo en La Basketneta
CODIGO_A_EQUIPO = {
    "BEL": "E1082", "CRO": "E1083", "FRA": "E1084", "GER": "E1085",
    "HUN": "E1086", "ISL": "E1087", "ISR": "E1088", "ITA": "E1089",
    "LAT": "E1090", "LTU": "E1091", "POL": "E1092", "SRB": "E1093",
    "SLO": "E1094", "ESP": "E1095", "SWE": "E1096", "TUR": "E1097",
}


def descargar_partidos_fiba():
    """Extrae el array `games` embebido en el HTML de la página de FIBA.
    Reintenta hasta 4 veces: los runners de GitHub a veces son rechazados."""
    import time
    ultimo_error = None
    for intento in range(4):
        if intento:
            time.sleep(20 * intento)  # 20s, 40s, 60s
        try:
            return _descargar_partidos_fiba_una_vez()
        except (RuntimeError, urllib.error.URLError) as e:
            ultimo_error = e
            print(f"Intento {intento + 1} fallido: {e}")
    raise RuntimeError(f"FIBA inaccesible tras 4 intentos: {ultimo_error}")


def _descargar_partidos_fiba_una_vez():
    req = urllib.request.Request(FIBA_URL, headers={
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/126.0.0.0 Safari/537.36"),
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    })
    try:
        html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"FIBA devolvió HTTP {e.code} al descargar la página") from e

    # El JSON va doblemente escapado dentro del payload RSC de Next.js
    idx = html.find('games\\":[{\\"gameId')
    if idx == -1:
        raise RuntimeError("No se encontró el bloque de partidos en el HTML de FIBA")

    fragmento = html[idx + len('games\\":') :]
    # Des-escapar: \\\" -> " y \\\\ -> \
    texto = fragmento.replace('\\\\', '\x00').replace('\\"', '"').replace('\x00', '\\')

    # Recortar el array JSON balanceando corchetes
    profundidad, fin = 0, None
    en_cadena, escape = False, False
    for i, c in enumerate(texto):
        if escape:
            escape = False
            continue
        if c == '\\':
            escape = True
            continue
        if c == '"':
            en_cadena = not en_cadena
            continue
        if en_cadena:
            continue
        if c == '[':
            profundidad += 1
        elif c == ']':
            profundidad -= 1
            if profundidad == 0:
                fin = i + 1
                break
    if fin is None:
        raise RuntimeError("No se pudo delimitar el array de partidos")
    return json.loads(texto[:fin])


def partido_terminado(g):
    return (
        not g.get("isLive")
        and g.get("teamAScore") is not None
        and g.get("teamBScore") is not None
        and g.get("teamAScore", 0) + g.get("teamBScore", 0) > 0
        and g.get("liveGameStatus") == 999
    )


def supabase_request(metodo, ruta, cuerpo=None):
    url = os.environ.get("SUPABASE_URL", "").rstrip("/") + ruta
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not key:
        raise RuntimeError(
            "SUPABASE_SERVICE_KEY está vacía: el secret no existe en el repo "
            "o tiene otro nombre (Settings > Secrets and variables > Actions)"
        )
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    req = urllib.request.Request(url, data=datos, method=metodo, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode() or "[]")
    except urllib.error.HTTPError as e:
        detalle = e.read().decode(errors="replace")[:300]
        raise RuntimeError(
            f"Supabase devolvió HTTP {e.code} en {metodo} {ruta}: {detalle}"
        ) from e


def main():
    juegos = descargar_partidos_fiba()
    print(f"FIBA: {len(juegos)} partidos en la página")

    # Partidos de la liga pendientes de resultado
    pendientes = supabase_request(
        "GET",
        f"/rest/v1/partidos?id_liga=eq.{ID_LIGA}&temporada=eq.{TEMPORADA}"
        f"&resultado_local=is.null"
        f"&select=id,id_equipo_local,id_equipo_visitante,fecha_hora",
    )
    print(f"DB: {len(pendientes)} partidos pendientes en {ID_LIGA}")
    if not pendientes:
        return

    actualizados = 0
    for g in juegos:
        if not partido_terminado(g):
            continue
        if not g.get("teamA") or not g.get("teamB"):
            continue  # eliminatoria sin equipos definidos aún
        local = CODIGO_A_EQUIPO.get(g["teamA"]["code"])
        visitante = CODIGO_A_EQUIPO.get(g["teamB"]["code"])
        if not local or not visitante:
            print(f"AVISO: código sin mapear en juego {g.get('gameId')}: "
                  f"{g['teamA']['code']} vs {g['teamB']['code']}")
            continue
        fecha_utc = g["gameDateTimeUTC"]  # "2026-07-04T12:30:00"

        for p in pendientes:
            # fecha_hora llega como "2026-07-04T12:30:00+00:00"
            fecha_db = p["fecha_hora"].replace(" ", "T")
            misma_fecha = fecha_db.startswith(fecha_utc[:16])
            mismos_equipos = (
                p["id_equipo_local"] == local
                and p["id_equipo_visitante"] == visitante
            )
            if misma_fecha and mismos_equipos:
                supabase_request(
                    "PATCH",
                    f"/rest/v1/partidos?id=eq.{p['id']}",
                    {
                        "resultado_local": g["teamAScore"],
                        "resultado_visitante": g["teamBScore"],
                    },
                )
                print(f"OK partido {p['id']}: {g['teamA']['code']} "
                      f"{g['teamAScore']}-{g['teamBScore']} {g['teamB']['code']}")
                actualizados += 1
                break

    print(f"Actualizados: {actualizados}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)