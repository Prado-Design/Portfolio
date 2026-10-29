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

`data-float-part` also takes a comma-separated list of parts, which float and lower together; `data-float-lift` sets how high they start, as a share of the model's height (default 0.3). `data-seat="plane"` stands the model on the grid's middle horizontal plane rather than centring it on that plane, which suits flat products:

```html
<div class="lattice" data-model="../../assets/models/reflectiv.glb" data-seat="plane" data-float-part="Tablet, Screen, Pen, Pen_Nib" data-float-lift="1.5"></div>
```

Callouts go in a `<ul class="callouts">` inside the grid box. Each item names a part, a point on it in that part's own coordinates (millimetres for the Reflectiv model), and where the leader turns into the label, in eighths of the grid width from the grid's centre (`class="left"` puts the label on the left). The leaders follow the model as it spins and lowers into place, and fade in once floating parts have settled:

```html
<li data-part="Pen" data-at="8 8.6 30" data-elbow="1.688 -0.264"><span>Stylus</span></li>
```

Part names are the glTF node names with spaces turned into underscores (`Pen Nib` → `Pen_Nib`).

Change the `?v=` tag whenever the model file changes, so browsers fetch the new one.

To cycle one material through several colours (the Reflectiv colourways), name the material and list the colours; it cross-fades to the next one every few seconds while the grid is on screen:

```html
<div class="lattice" data-model="../../assets/models/reflectiv.glb?v=cad7" data-colorway-material="Anodized Aluminium" data-colorways="#a4a4a4, #4c615e, #3d4d56, #8c6668"></div>
```
