# Master Viviana × BellaShop · Versión 1

Sistema independiente para registrar estudiantes referidas por una profesora, verificarlas por celular y administrar descuentos para códigos exactos de productos, con una identidad visual premium en rosado pastel y dorado para la campaña Master Viviana × BellaShop.

## Estructura

- `index.html?profe=viviana`: registro público accesible desde el QR.
- `admin.html`: inicio de sesión, búsqueda, suspensión/reactivación, beneficios, enlaces y QR.
- `privacidad.html`: borrador de aviso de datos personales — **completar antes de publicar**.
- `config.js`: URL y clave **publicable** de Supabase; nunca poner una clave secreta aquí.
- `supabase/schema.sql`: tablas, restricciones, permisos y reglas de seguridad (RLS).
- `supabase/functions/register-student/index.ts`: servicio público de registro, con validaciones y comprobación opcional de Cloudflare Turnstile.

## Instalar por primera vez

1. Crear un **repositorio público nuevo** en la cuenta de GitHub de BellaShop: `bella-shop-beneficios`. No reutilizar `bella-shop-pruebas`, `bella-shop-carrito` ni `rutaya`.
2. Crear **un proyecto nuevo de Supabase** llamado `bella-shop-beneficios`, preferiblemente en la misma organización BellaShop. La creación puede tener costos según el plan: revisarlos antes de aceptar.
3. En el proyecto nuevo, ejecutar `supabase/schema.sql` con `SQL Editor`. **NO ejecutar en otros proyectos.** El script crea una profesora provisional con nombre `Master Viviana` e identificador `viviana`.
4. En Supabase > Authentication > Users, crear manualmente el usuario administrativo con correo electrónico y contraseña fuerte. Copiar el UID y ejecutar este comando en SQL Editor sustituyendo el UID real:

   ```sql
   insert into public.admins (user_id) values ('UUID_REAL_DEL_USUARIO');
   ```

5. Desplegar la función `register-student` desde Supabase Edge Functions con `verify_jwt=false` **porque es un registro público**. Usa `SUPABASE_URL` y la clave de servidor `BELLA_SERVER_KEY` configuradas como secretos; si no se define `BELLA_SERVER_KEY`, usa `SUPABASE_SERVICE_ROLE_KEY` cuando esté disponible. **NUNCA publicar claves de servidor en GitHub ni en config.js.**
6. Antes de recibir registros reales, activar Cloudflare Turnstile: `TURNSTILE_SECRET` solo en los secretos de Edge Functions, `turnstileSiteKey` público en `config.js`. También configurar `ALLOWED_ORIGIN` con el origen exacto de GitHub Pages, por ejemplo `https://bellashopinsumos-dotcom.github.io` (sin `/bella-shop-beneficios/`). Este servicio no incorpora por ahora una limitación transaccional por IP: Turnstile es obligatorio para activar el registro público: esta versión de la función rechaza registros si falta TURNSTILE_SECRET.
7. Copiar la URL del nuevo proyecto y su **publishable key** (`sb_publishable_...`) en `config.js`, que es el archivo que también se sube a GitHub Pages. No usar `sb_secret_...` aquí.
8. Completar `privacidad.html` con los datos reales del responsable y política correspondiente; el borrador actual no es una política final. Confirmar la grafía oficial del nombre de la profesora y actualizarlo en la tabla `teachers`.
9. Subir los archivos (conservar las rutas de subcarpetas), entrar a Settings > Pages > Deploy from a branch > `main` > `/ (root)`.
10. Cuando GitHub Pages esté activo, abrir `https://bellashopinsumos-dotcom.github.io/bella-shop-beneficios/?profe=viviana`. Este enlace es una **URL prevista**, no se ha publicado aún. Ingresar a `admin.html` con la cuenta autorizada y generar el QR desde la sección Profesoras y QR.

## Pruebas antes de compartir el QR

- Registrar un número de prueba con permiso expreso y comprobar que aparece en la tabla privada.
- Probar repetir el mismo teléfono: debe devolver recepción genérica sin crear dos filas.
- Probar un teléfono inválido y rechazo de autorización.
- Acceder a `/rest/v1/students` usando solo la clave publicable: **no debe devolver ninguna fila ni permitir inserciones.**
- Probar inicio de sesión con una cuenta no autorizada: **no debe ver datos.**
- Crear un descuento para un código exacto, comprobar que aparece solo si está vigente y para su profesora.
- Suspender una estudiante, comprobar que el descuento deja de aparecer al buscarla.
- Confirmar que la política de privacidad está terminada antes de usar datos reales.

## Decisiones de producto

- Una estudiante se identifica por un celular único, vinculado a la profesora con la que se inscribió originalmente. Cambios de profesor requieren intervención administrativa para evitar conflictos.
- El formulario no pide correo ni crea cuentas para estudiantes.
- **No se aplica ningún descuento automáticamente** al carrito o al POS: la persona de BellaShop debe verificarlo y aplicar la promoción en tienda.
- Beneficios necesitan porcentajes, fechas y códigos de producto exactos. Un código omitido no tiene descuento.
- Los datos personales nunca están disponibles para visitantes públicos; acceso administrativo mediante Supabase Auth y RLS.
- Los registros usan consentimiento, pero el borrador de la política exige revisión legal y datos de contacto.

## Nota de seguridad

La función pública exige validación, origen autorizado, honeypot y Turnstile; no incorpora auditoría ni límites transaccionales de solicitudes; para una versión de mayor tráfico se recomienda añadirlos. El control de origen **no sustituye** captcha ni autenticación. Evita desplegar sin completar primero la protección antiabuso y la política de datos.

## Publicación GitHub Pages (automática)

El repositorio incorpora `.github/workflows/pages.yml` para publicar automáticamente la página desde `main`. Si el primer despliegue no activa GitHub Pages, ve a Settings > Pages > Build and deployment y selecciona GitHub Actions como origen; comprueba el resultado en la pestaña Actions. No compartir el QR mientras Supabase, Turnstile y la política de privacidad sigan pendientes.
