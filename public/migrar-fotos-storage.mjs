// migrar-fotos-storage.mjs
//
// Qué hace:
// 1. Busca en `jugadoras` todas las filas donde `foto` empieza por "data:image"
//    (es decir, está incrustada en base64 en lugar de ser una URL).
// 2. Decodifica cada imagen y la sube como archivo real al bucket
//    "fotos-jugadoras" en Supabase Storage.
// 3. Actualiza la columna `foto` de esa fila con la URL pública del archivo subido.
//
// Es seguro volver a ejecutarlo si se corta a mitad: las filas que ya fueron
// migradas (foto ya no empieza por "data:image") se saltan automáticamente.
//
// CÓMO EJECUTARLO:
//   1. npm install @supabase/supabase-js
//   2. Define las variables de entorno (o edítalas abajo directamente):
//        SUPABASE_URL=https://qvtxqckuolacvnvrvysu.supabase.co
//        SUPABASE_KEY=<tu anon key o service_role key, la misma que usa App.jsx>
//   3. node migrar-fotos-storage.mjs
//
// El script imprime un resumen al final con cuántas se migraron, cuántas
// fallaron (y por qué), y el ahorro de espacio resultante.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'PEGA_AQUI_TU_URL_SI_NO_USAS_ENV';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'PEGA_AQUI_TU_KEY_SI_NO_USAS_ENV';
const BUCKET = 'fotos-jugadoras';

if (SUPABASE_URL.startsWith('PEGA_AQUI') || SUPABASE_KEY.startsWith('PEGA_AQUI')) {
  console.error('❌ Faltan credenciales. Define SUPABASE_URL y SUPABASE_KEY como variables de entorno, o edítalas directamente en este archivo.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function parseDataUri(dataUri) {
  // formato esperado: data:image/jpeg;base64,/9j/4AA...
  const match = dataUri.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;
  const [, ext, base64Data] = match;
  const buffer = Buffer.from(base64Data, 'base64');
  return { ext: ext === 'jpeg' ? 'jpg' : ext, buffer };
}

async function main() {
  console.log('🔍 Buscando jugadoras con foto en base64...\n');

  const { data: rows, error: fetchError } = await supabase
    .from('jugadoras')
    .select('id_jugadora, nombre, foto')
    .like('foto', 'data:image%');

  if (fetchError) {
    console.error('❌ Error al consultar jugadoras:', fetchError.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('✅ No quedan fotos en base64 por migrar. Nada que hacer.');
    return;
  }

  console.log(`📋 Encontradas ${rows.length} jugadoras con foto en base64.\n`);

  let migradas = 0;
  let fallidas = 0;
  let bytesAhorrados = 0;
  const errores = [];

  for (const row of rows) {
    const { id_jugadora, nombre, foto } = row;
    const parsed = parseDataUri(foto);

    if (!parsed) {
      console.log(`⚠️  ${id_jugadora} (${nombre}): formato de foto no reconocido, se omite.`);
      fallidas++;
      errores.push({ id_jugadora, nombre, motivo: 'formato no reconocido' });
      continue;
    }

    const { ext, buffer } = parsed;
    const filePath = `${id_jugadora}.${ext}`;
    const pesoOriginal = foto.length;

    try {
      // Subir el archivo (upsert: true permite re-ejecutar sin error si ya existe)
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, buffer, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('jugadoras')
        .update({ foto: publicUrl })
        .eq('id_jugadora', id_jugadora);

      if (updateError) {
        throw updateError;
      }

      bytesAhorrados += pesoOriginal - publicUrl.length;
      migradas++;
      console.log(`✅ ${id_jugadora} (${nombre}): migrada → ${publicUrl}`);
    } catch (err) {
      fallidas++;
      errores.push({ id_jugadora, nombre, motivo: err.message || String(err) });
      console.log(`❌ ${id_jugadora} (${nombre}): ERROR — ${err.message || err}`);
    }
  }

  console.log('\n──────────────────────────────────────────');
  console.log(`RESUMEN`);
  console.log(`──────────────────────────────────────────`);
  console.log(`Migradas con éxito : ${migradas}`);
  console.log(`Fallidas           : ${fallidas}`);
  console.log(`Ahorro estimado    : ${(bytesAhorrados / 1024).toFixed(1)} KB en la tabla jugadoras`);

  if (errores.length > 0) {
    console.log('\nDetalle de fallos:');
    errores.forEach(e => console.log(`  - ${e.id_jugadora} (${e.nombre}): ${e.motivo}`));
    console.log('\nPuedes volver a ejecutar el script: las filas ya migradas se saltan automáticamente.');
  }
}

main();
