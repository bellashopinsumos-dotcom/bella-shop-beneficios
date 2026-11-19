# Master Viviana × BellaShop

Sistema independiente de BellaShop para registrar estudiantes referidas por Master Viviana y gestionar sus beneficios mediante un administrador privado.

## Estado verificado — 19 de noviembre de 2026

- ✅ Repositorio GitHub `bellashopinsumos-dotcom/bella-shop-beneficios` con registro, estilos rosa pastel y dorado, administrador y código backend.
- ✅ Workflow de GitHub Pages guardado en `.github/workflows/pages.yml`. **La activación y publicación efectiva deben confirmarse en Settings > Pages y Actions.**
- ✅ Proyecto Supabase **Master Viviana** creado en la organización BellaShop (`faijbrdkxuqcgszlxqrx`), región us-east-2.
- ✅ Tablas `teachers`, `students`, `benefits` y `admins` creadas con RLS.
- ✅ Comprobado: el rol anónimo NO puede consultar estudiantes ni beneficios, ni insertar estudiantes directamente.
- ✅ Profesora inicial `Master Viviana` con identificador `viviana`.
- ✅ Función `register-student` publicada. **No recibe registros hasta completar la protección antispam.**
- ✅ `config.js` conectado a la URL y clave **publicable** del proyecto nuevo.
- ⏳ Alta del usuario administrador, captcha, política de datos y verificación funcional completa todavía pendientes.
- ⛔ `registrationEnabled: false` en `config.js`. No activar hasta finalizar los pasos siguientes.

## Accesos

- Supabase: https://supabase.com/dashboard/project/faijbrdkxuqcgszlxqrx
- Repositorio: https://github.com/bellashopinsumos-dotcom/bella-shop-beneficios
- URL prevista del registro: https://bellashopinsumos-dotcom.github.io/bella-shop-beneficios/?profe=viviana
- URL prevista del administrador: https://bellashopinsumos-dotcom.github.io/bella-shop-beneficios/admin.html

**Importante:** estas URLs de GitHub Pages son previstas, no confirmadas como publicadas.

## Pendientes obligatorios para el lanzamiento

### 1. Crear administrador

En el proyecto **Master Viviana** (¡no tocar RutaYa!), entra a **Authentication > Users** y crea el usuario que utilizará el personal de BellaShop. Usa una contraseña fuerte y correo controlado por el responsable. Copia su UID de Supabase Auth.

En SQL Editor del mismo proyecto ejecuta:

```sql
insert into public.admins (user_id) values ('UID_REAL_DEL_USUARIO');
```

No compartas contraseñas por chat ni las subas a GitHub.

### 2. Proteger con Cloudflare Turnstile

Crea un widget **Cloudflare Turnstile** para el dominio `bellashopinsumos-dotcom.github.io`.

- Copia la **site key pública** a `turnstileSiteKey` en `config.js`.
- Coloca **TURNSTILE_SECRET** en el proyecto Master Viviana, dentro de **Edge Functions > Secrets**. Nunca la subas al repositorio.
- La función `register-student` bloquea registros si falta `TURNSTILE_SECRET`. Además, necesita `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (variables que normalmente ofrece automáticamente Supabase a sus Edge Functions). Si no están presentes, configúralas en un entorno seguro, no en GitHub.
- El origen permitido por defecto es `https://bellashopinsumos-dotcom.github.io`. Si cambias el dominio, configura `ALLOWED_ORIGIN` en secretos.
- Para mayor escala, agregar límites por IP, monitoreo y controles adicionales.

### 3. Completar privacidad

Antes de guardar estudiantes reales, termina `privacidad.html` con:
- Responsable legal de BellaShop e identificación.
- Correo o canal oficial para ejercer derechos.
- Plazo de conservación, eliminación y versión final aprobada de la política.
- Una revisión adecuada a la normativa aplicable en Colombia.

No uses los números registrados para campañas publicitarias sin autorización específica.

### 4. Publicar y comprobar

1. Verifica GitHub **Settings > Pages**. Si no se publica con el workflow ya creado, selecciona **GitHub Actions** como fuente y revisa la pestaña **Actions**.
2. En `config.js`, cambia `registrationEnabled` a `true` **solo tras terminar 1, 2 y 3**.
3. Abre el registro con `?profe=viviana` y realiza un registro autorizado de prueba.
4. Confirma en el administrador que aparece el registro y que buscar por teléfono funciona.
5. Prueba el control de duplicados, una estudiante suspendida, y un beneficio con códigos de producto exactos y fecha vigente.
6. Genera el QR dentro de la pestaña **Profesoras y QR**.

## Sistema

- `index.html`: registro público de estudiante.
- `admin.html`: acceso protegido, búsqueda, estados, beneficios y QR.
- `privacidad.html`: borrador con información legal pendiente.
- `api.js`, `app.js`, `admin.js`: lógica de frontend.
- `config.js`: URL y clave pública; nunca guardar secretos.
- `supabase/schema.sql`: esquema aplicado al proyecto Master Viviana.
- `supabase/functions/register-student/index.ts`: servicio de registro ya desplegado.
- `.github/workflows/pages.yml`: pipeline de publicación automática.

**No existe conexión con RutaYa ni con el inventario de BellaShop.** Los descuentos no se aplican solos: el personal verifica celular y códigos en tienda.
