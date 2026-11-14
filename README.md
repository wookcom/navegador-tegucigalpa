# NavGame TGU — Navegador 3D y Desvíos de Puentes (Choluteca → Tegucigalpa)

Aplicación web móvil en tiempo real diseñada con una **flecha 3D superior estilo videojuego** y visualización **multicamino** (camino correcto en verde neón vs. retornos/puentes a evitar en rojo) para resolver confusiones de carriles en los pasos a desnivel de Tegucigalpa.

## Itinerario por defecto (100% editable y reordenable)
1. **Origen:** Choluteca, Honduras (`13.3061, -87.1956`) o GPS actual
2. **Parada 1:** Iglesia San Judas Tadeo (`14.0799, -87.1569`)
3. **Parada 2:** La Reserva Event Center, Miraflores (`14.0744, -87.1927`)
4. **Parada 3 (Final):** Hotel Comfort Inn Tegucigalpa, contiguo a Mall Las Cascadas (`14.0759, -87.1994`)

## Puentes y desvíos críticos marcados
1. **Entrada Sur (Loarque / CA-5 → Anillo Periférico)**
2. **Anillo Periférico → Desvío Bulevar Suyapa / UNAH**
3. **Anillo Periférico → Bulevar Fuerzas Armadas**
4. **Blvd. FF.AA. → Av. Santa Cristina (Miraflores)**
5. **Mall Las Cascadas → Entrada lateral Hotel Comfort Inn (NO subir el puente)**

## Despliegue en Vercel o GitHub Pages
- Compatible con **Vercel** (zero-config Vite build: `npm run build` → `dist`) y con **GitHub Pages** directo desde la raíz.
