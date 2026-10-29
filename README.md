# Jon Prado — Digital Portfolio

Portfolio site for industrial designer Jon Prado. Plain HTML, CSS and JavaScript with no build step; t
he home page and the Cántaro project use three.js (loaded from jsDelivr) for the 3D grid and model.

## Run locally

```sh
python3 -m http.server 8791
```

Then open http://127.0.0.1:8791. Links are root-relative, so the site needs to be served rather than o
pened as files.

## Structure

- `index.html`, `projects/`, `about/`, `contact/`, `work/<project>/`, `blog/`, `404.html`: pages
- `assets/css/style.css`: all styles
- `assets/js/main.js`: interactions (menu, scroll effects, 2D grid fallback, carousel)
- `assets/js/lattice3d.js`: the 3D grid and model viewer
- `assets/models/`: 3D models (GLB)
- `assets/img/`: images

## 3D model

The grid box takes its model from `data-model` (`.glb`, `.gltf`, `.stl` or `.obj`) and, optionally, a
part that floats above and lowers into place on scroll from `data-float-part`:

```html
<div class="lattice" data-model="/assets/models/cantaro.glb?v=cad5" data-float-part="Lid"></div>
```

Change the `?v=` tag whenever the model file changes, so browsers fetch the new one.
