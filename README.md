# Covenant Tracker â Link Capital Partners

Dashboard de monitoreo de covenants con actualizaciÃ³n automÃ¡tica desde PDFs via Claude AI.

## Deploy en Vercel (5 minutos)

### 1. Sube este repositorio a GitHub
- Ve a github.com â New repository â "covenant-tracker"
- Sube todos estos archivos

### 2. Conecta con Vercel
- Ve a vercel.com â New Project â Import desde GitHub
- Selecciona "covenant-tracker"

### 3. Agrega variables de entorno en Vercel
En Settings â Environment Variables:
```
ANTHROPIC_API_KEY = tu_clave_de_anthropic
```

### 4. Conecta Vercel KV (base de datos)
- En tu proyecto Vercel â Storage â Create Database â KV
- Vercel agrega automÃ¡ticamente KV_REST_API_URL y KV_REST_API_TOKEN

### 5. Deploy
Vercel despliega automÃ¡ticamente. Tu equipo accede en:
`https://covenant-tracker-tuusuario.vercel.app`

## CÃ³mo actualizar covenants

1. Ve a **Emisores**
2. Haz clic en **"ð Subir EEFF"** en cualquier emisor
3. Sube el PDF del estado financiero
4. Claude AI extrae los ratios automÃ¡ticamente
5. Revisa los valores detectados y guarda

Los cambios quedan guardados para todo el equipo en tiempo real.

## Stack tÃ©cnico
- Next.js 14 (frontend + API routes)
- Claude AI (extracciÃ³n de datos desde PDFs)
- Vercel KV (storage compartido entre usuarios)
- Vercel (hosting gratuito)

