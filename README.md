# Piso Tipo D · maqueta 3D

Maqueta 3D interactiva de un piso de tres dormitorios y dos baños con terraza,
en Bormujos (Sevilla), levantada a partir del plano comercial y de tres renders
de la cocina (`docs/`). Todo es estático: no hay servidor ni integraciones.

**Web:** https://javicebrian.github.io/oficina-dcapiu/

- Girar, desplazar y acercar; vistas aérea, en planta, de la cocina y de la terraza.
- Clic en una estancia: superficie y medidas; puede encuadrarla y recortar las paredes que la tapan.
- Clic en puertas y ventanas para abrirlas; la columna alta de la cocina se abre y deja ver el termo.
- Clic en las lámparas y focos para encenderlos.
- Sol real sobre Bormujos a cualquier fecha y hora, o ahora mismo; techo y corte de sección.

```bash
npm install
npm run dev      # vite en :5178
npm run build    # dist/
```

Cada push a `main` se publica en GitHub Pages (`.github/workflows/pages.yml`).
