# Master Viviana × BellaShop — campaña temporal

Sitio público con registro directo de estudiantes y administrador privado de BellaShop.

## Estado de producción (19 de noviembre de 2026)

**Proyecto Supabase:** Master Viviana — https://supabase.com/dashboard/project/faijbrdkxuqcgszlxqrx

**Página pública:** https://bellashopinsumos-dotcom.github.io/bella-shop-beneficios/?profe=viviana

**Panel:** https://bellashopinsumos-dotcom.github.io/bella-shop-beneficios/admin.html

**Administrador autorizado:** bellashopinsumos@gmail.com

- ✅ Registro habilitado automáticamente para quienes escaneen el QR. No existe una etapa de aprobación.
- ✅ El formulario comprueba nombre, celular colombiano y autorización de datos personales.
- ✅ El registro se almacena de inmediato con estado "active".
- ✅ Manejo de números duplicados sin revelar datos existentes.
- ✅ Backend Edge Function "register-student" desplegado, con límites de solicitudes por IP y global y campo trampa anti-bots.
- ✅ El captcha Turnstile puede añadirse en el futuro; de momento no tiene clave configurada y no bloquea el registro.
- ✅ RLS: los registros de estudiantes y beneficios no son públicos.
- ✅ Autorizado el administrador BellaShop por cuenta verificada.
- ✅ Gestión de estudiantes: búsqueda, alta manual con autorización, edición, cambio de estado, eliminación individual, exportación CSV.
- ✅ Gestión de promociones: alta, edición, activación, desactivación, eliminación y vigencia por códigos de producto.
- ✅ Gestión de profesoras: alta, edición, desactivación, eliminación si no tiene referencias, enlaces QR.
- ✅ Gestión de campaña: habilitación/deshabilitación de nuevos registros y fecha opcional de cierre desde el panel.
- ✅ Página de privacidad accesible con contacto oficial BellaShop.
- ⏳ Completar la identificación legal de la persona responsable y formalizar el periodo de retención, conforme a las obligaciones aplicables.
- ⏳ Confirmar visualmente la interfaz en un navegador real tras publicar GitHub Pages y realizar pruebas integrales del panel.
- ⏳ Recomendación Supabase: activar protección contra contraseñas filtradas.

### Importante

No hay conexión con RutaYa ni con la base de inventario de BellaShop.

La función de registro requiere secretos de servidor gestionados automáticamente por Supabase. **Nunca subir claves de servicio al repositorio**. La clave publicable de \`config.js\` sí puede ser visible.

El frontend sólo controla la experiencia visual; el backend comprueba el estado de campaña y escribe los registros usando permisos de servidor. Cerrar la campaña en el administrador impide nuevas inscripciones incluso si la página pública está abierta en otro dispositivo.

Las descargas CSV contienen datos personales: almacenar y compartir con cuidado y eliminar cuando dejen de ser necesarias.

### Estructura

- \`index.html\`, \`app.js\`: registro público.
- \`admin.html\`, \`admin.js\`: administrador.
- \`privacidad.html\`: información del tratamiento de datos.
- \`config.js\`: configuración pública.
- \`api.js\`: comunicación con Supabase, autenticación y solicitudes.
- \`supabase/schema.sql\`: esquema inicial **para proyectos nuevos, no reejecutar** en la base existente.
- \`supabase/functions/register-student/index.ts\`: función de registro desplegada.
- \`.github/workflows/pages.yml\`: publicación automática por GitHub Pages.

Para terminar la temporada: entrar al panel, sección **Temporada**, desmarcar "Permitir nuevas inscripciones" y pulsar "Guardar temporada". El enlace QR sigue existiendo, pero ya no admitirá nuevas inscripciones.



## Campaña Master Viviana Galvis — redes y WhatsApp

- Nombre público de la profesora: **Master Viviana Galvis**; el slug del QR original sigue siendo \`viviana\` para **no cambiar el enlace ya compartido**.
- Mensaje de bienvenida: «En Master Viviana Galvis y BellaShop hemos preparado un espacio para ti en el mundo de las uñas. ¡Bienvenidos!».
- Es obligatorio que la estudiante declare seguir las cuentas de BellaShop en **Instagram** (\`@bellashop_byluisazu\`) y **TikTok** (\`@bellashopbyluisazu\`) para enviar el formulario.
- Hay enlaces visibles con logos a ambas redes y una casilla de confirmación requerida. El backend exige \`social_follow_confirmed=true\` y registra \`social_follow_declared_at\`. **Es una declaración de la estudiante: no es una verificación automática de las plataformas.**
- Botón de ayuda y contacto a **WhatsApp 3122002698**, con mensaje escrito para una estudiante de la profesora Viviana Galvis. También aparece tras registrarse.
- Se actualizaron el aviso de tratamiento de datos, el panel administrativo (muestra la fecha de la declaración), la base y el servicio de registro de Supabase.

## Descuentos visibles al terminar el registro y primeras 2 compras

- Después de inscribirse, la estudiante ve los beneficios activos y vigentes de su profesora directamente desde Supabase. No se inventan porcentajes ni ofertas.
- Cada descripción de descuento guardada en `product_codes` se presenta tal cual; los productos ingresados como códigos reciben el porcentaje indicado en ese beneficio. IMPORTANTE: el beneficio de Master Viviana Galvis contiene descripciones de descuentos mixtos, no verdaderos SKU. No interpretarlos como un 10 % general.
- Mensaje a estudiantes: **«¡Listo! Ya puedes disfrutar de precios especiales»**, con el aviso **«¡Disfrútalos en tus primeras 2 compras!»**.
- En el administrador, cada estudiante tiene un contador **Compras con beneficio: 0/2, 1/2 o 2/2**; se registra una compra manualmente con confirmación y se puede deshacer en caso de error.
- Una tercera compra con beneficio está bloqueada por validación de interfaz y restricción SQL de la columna `benefit_purchases_used`.
- No existe integración automática con la caja de BellaShop: el personal debe registrar cada compra en el panel al aplicar el descuento.
- Los datos de estudiantes no quedan expuestos: la función de registro solo devuelve descuentos publicados y vigentes para la profesora, nunca datos de otros estudiantes.
