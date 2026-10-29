# Jon Prado — Digital Portfolio

Portfolio site for industrial designer Jon Prado. Plain HTML, CSS and JavaScript with no build step; the home page and the Cántaro project use three.js (loaded from jsDelivr) for the 3D grid and model.

## Run locally

```sh
python3 -m http.server 8791
```

Then open http://127.0.0.1:8791. Serve it rather than opening the files directly, so the folder links (`about/`, `work/cantaro/`) resolve to their `index.html`.

## Host on GitHub Pages

All paths are relative, so the site works at a domain root or in a subfolder.

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*, then choose **main** and **/ (root)**, and save.
3. After a minute the site is live at `https://<username>.github.io/<repository>/`.

`.nojekyll` tells Pages to serve the files as they are. `404.html` works at any depth: it sets its base to the site root on `*.github.io` project sites and to `/` everywhere else, including a custom domain (Settings → Pages → Custom domain).

## Structure

- `index.html`, `projects/`, `about/`, `contact/`, `work/<project>/`, `blog/`, `404.html`: pages
- `assets/css/style.css`: all styles
- `assets/js/main.js`: interactions (menu, scroll effects, 2D grid fallback, carousel)
- `assets/js/lattice3d.js`: the 3D grid and model viewer
- `assets/models/`: 3D models (GLB)
- `assets/img/`: images

## 3D model

The grid box takes its model from `data-model` (`.glb`, `.gltf`, `.stl` or `.obj`) and, optionally, a part that floats above and lowers into place on scroll from `data-float-part`:

```html
<div class="lattice" data-model="/assets/models/cantaro.glb?v=cad5" data-float-part="Lid"></div>
```

Change the `?v=` tag whenever the model file changes, so browsers fetch the new one.
