# NuestroEspacio Perú v2.4 PWA

Aplicación web responsive para administrar en pareja las finanzas del hogar, el mercado, la despensa, recetas peruanas, tareas y configuraciones familiares.

## Despliegue

Todos los archivos deben subirse directamente a la raíz del repositorio de GitHub Pages, sin carpetas:

- `index.html`
- `styles.css`
- `products.js`
- `recipes.js`
- `app.js`
- `README.md`
- `manifest.webmanifest`
- `sw.js`
- `pwa.js`
- `icon-192.png`
- `icon-512.png`
- `icon-maskable-512.png`
- `favicon.png`

No requiere compilación. Para usar todas las funciones PWA debe publicarse mediante HTTPS, por ejemplo con GitHub Pages. Después de la primera carga online puede abrirse sin conexión.


## Instalación como PWA

### iPhone / iPad

1. Abre la web publicada en Safari.
2. Toca **Compartir**.
3. Selecciona **Agregar a pantalla de inicio**.
4. Abre NuestroEspacio desde el nuevo icono.

### Android / escritorio

Usa el botón de instalación de la cabecera o selecciona **Instalar aplicación** desde el menú de Chrome o Edge.

La PWA incluye `manifest.webmanifest`, iconos, accesos rápidos y un Service Worker con caché versionada.

## Persistencia

Los datos se guardan automáticamente en el navegador mediante `localStorage`, usando la clave:

```text
nuestroEspacio_v1
```

Actualizar los archivos del proyecto no elimina la información guardada en el mismo navegador y dominio. Antes de borrar datos del sitio, conviene conservar una copia del almacenamiento.

## Funciones principales

### Finanzas

- Ingresos por integrante, sueldo y bonos.
- Primera quincena y fin de mes.
- Gastos fijos, diarios, hormiga, mercado y eventuales.
- Indicadores del mes actual.
- Gráficos por categoría y periodo.
- Buscador e historial financiero.
- Botón **Cuadrar gastos** para auditar vínculos entre compras y gastos.

### Mercado

- Catálogo de productos con precios referenciales de Lima.
- Precios de mercado, supermercado y mayorista.
- Carrito dinámico por categorías.
- Presupuesto mensual, gasto real, pendiente y disponible proyectado.
- Registro del total real pagado.
- Creación automática de un gasto de Mercado por cada compra realizada.

### Despensa

- Stock, mínimo, consumo diario y vencimiento.
- Duración estimada según el número de personas del hogar.
- Conversión entre unidades de compra y unidades de despensa.
- Reposición directa hacia Mercado.

### Recetas peruanas

- Recetas de Costa, Sierra y Selva.
- Cantidades escalables según el número de personas.
- Cálculo de faltantes según la despensa.
- Conversión global de ingredientes a presentaciones reales de compra.

### Configuración

- Integrantes del hogar.
- Cantidad de personas.
- Presupuesto del mercado.
- Estimación mensual de gastos hormiga.
- Sueldos y gastos fijos editables.
- Tema claro y oscuro.

## Conciliación de gastos v2.3

Esta versión unifica las cifras financieras con una sola fuente contable:

1. Cada compra marcada como realizada tiene un único gasto enlazado mediante `sourceCartId`.
2. Si una compra antigua no tenía vínculo, la app intenta reconocer su gasto por nombre, importe y mes.
3. Los gastos duplicados vinculados a la misma compra se eliminan automáticamente.
4. Si una compra se vuelve a marcar como pendiente o se elimina, su gasto enlazado también se elimina.
5. Editar el importe de un gasto enlazado actualiza el total real de la compra.
6. Dashboard, quincenas, gráficos y proyecciones usan únicamente movimientos del mes actual.
7. El gasto hormiga estimado solo descuenta la parte todavía no registrada, evitando contabilizarla dos veces.
8. El presupuesto de Mercado descuenta tanto lo ya gastado como lo pendiente.

## Moneda y alcance de precios

- Moneda: sol peruano (`PEN`, mostrado como `S/`).
- Formato regional: `es-PE`.
- Los precios del catálogo son referenciales y editables. Pueden variar por distrito, temporada, marca, presentación y establecimiento.

## Versión

**NuestroEspacio Perú v2.4 PWA**  
Añade instalación en iPhone, Android y escritorio, funcionamiento offline, iconos, manifest y actualización mediante Service Worker.
