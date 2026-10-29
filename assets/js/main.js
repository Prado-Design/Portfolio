/* Jon Prado — Digital Portfolio: interactions (no dependencies) */
(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---- film grain: one noise tile generated on load ---- */
  const grain = $(".grain");
  if (grain) {
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    grain.style.backgroundImage = `url(${c.toDataURL()})`;
  }

  /* ---- mobile menu ---- */
  const menuBtn = $(".menu-btn");
  if (menuBtn) {
    const label = $(".menu-btn .txt");
    const setOpen = (open) => {
      document.body.classList.toggle("menu-open", open);
      menuBtn.setAttribute("aria-expanded", open);
      label.textContent = open ? "close" : "menu";
    };
    menuBtn.addEventListener("click", () => setOpen(!document.body.classList.contains("menu-open")));
    $$(".nav-links a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
    addEventListener("keydown", (e) => e.key === "Escape" && setOpen(false));
    matchMedia("(min-width: 810px)").addEventListener("change", (e) => e.matches && setOpen(false));
  }

  /* ---- hero word rotator ---- */
  const rotator = $(".rotator");
  if (rotator) {
    const words = $$("span", rotator);
    let i = 0;
    words[0].classList.add("is-active");
    if (!reduced && words.length > 1) {
      setInterval(() => {
        const prev = words[i];
        i = (i + 1) % words.length;
        prev.classList.replace("is-active", "is-leaving");
        words[i].classList.remove("is-leaving");
        words[i].classList.add("is-active");
        setTimeout(() => prev.classList.remove("is-leaving"), 800);
      }, 2400);
    }
  }

  /* ---- hero lattice: diamonds + nodes, sized to the column grid ---- */
  const lattice = $(".lattice");
  if (lattice) {
    // The lattice's vertical lines are CSS borders on the same 8/4-column grid as the page's
    // background lines, so the browser rounds both to identical pixels. The SVG only draws
    // the diagonals and nodes, placed from those borders.
    const cols8 = document.createElement("div");
    cols8.className = "lattice-cols";
    cols8.innerHTML = "<span></span>".repeat(8);
    const draw = () => {
      // replace only the 2D drawing; the 3D canvas (lattice3d.js) may share this box
      lattice.querySelector(":scope > svg")?.remove();
      if (!cols8.isConnected) lattice.prepend(cols8);
      const box = lattice.getBoundingClientRect();
      const w = box.width, h = box.height;
      // geometry measured from the original artwork: 8 columns (4 on mobile),
      // diamonds two columns wide, nodes on the vertical lines, rise of 0.49 column per column
      const spans = [...cols8.children].filter((el) => el.offsetParent);
      const xs = spans.map((el) => el.getBoundingClientRect().left + 0.5 - box.left);
      xs.push(spans.at(-1).getBoundingClientRect().right - 0.5 - box.left);
      const cols = xs.length - 1;
      const cw = (xs[cols] - xs[0]) / cols, s = cw * 0.489;
      const r = Math.min(6, Math.max(3, cw * 0.037));
      const ns = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.setAttribute("aria-hidden", "true");
      let d = "";
      // diagonals as polylines through the node rows on every line, so they cross exactly at the nodes;
      // one every 2s of intercept, the viewBox clips the overhang
      const run = cols * s;
      for (let c = -run; c <= h + run; c += 2 * s) {
        d += "M" + xs.map((x, k) => `${x} ${c + k * s}`).join("L");
        d += "M" + xs.map((x, k) => `${x} ${c - k * s}`).join("L");
      }
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", d);
      path.setAttribute("pathLength", "1");
      path.classList.add("draw");
      svg.appendChild(path);
      let n = 0;
      for (let k = 1; k < cols; k++) {
        for (let y = (k % 2) * s; y <= h; y += 2 * s) {
          const c = document.createElementNS(ns, "circle");
          c.setAttribute("cx", xs[k]); c.setAttribute("cy", y); c.setAttribute("r", r);
          c.style.animationDelay = `${0.6 + (n++ % 17) * 0.05}s`;
          svg.appendChild(c);
        }
      }
      lattice.append(svg);
    };
    draw();
    let lw = innerWidth;
    addEventListener("resize", () => { if (innerWidth !== lw) { lw = innerWidth; draw(); } });
  }

  /* ---- split reveal text into words ---- */
  $$(".reveal-words").forEach((el) => {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) return frag.append(part);
            const s = document.createElement("span");
            s.className = "w"; s.textContent = part;
            frag.append(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
    };
    walk(el);
  });
  const revealWords = $$(".reveal-words .w");

  /* ---- fade-up on enter ---- */
  if ("IntersectionObserver" in window && !reduced) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { rootMargin: "0px 0px -10% 0px" });
    $$(".fx").forEach((el) => io.observe(el));
  } else $$(".fx").forEach((el) => el.classList.add("in"));

  /* ---- scroll-linked: progress bar, word reveal, card stack ---- */
  const progress = $(".nav-progress");
  const cards = $$(".stack .card");
  cards.forEach((c, i) => c.style.setProperty("--i", i));

  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const vh = innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;

    const line = vh * 0.72;
    for (const w of revealWords) {
      const on = w.getBoundingClientRect().top < line;
      if (on !== w.classList.contains("on")) w.classList.toggle("on", on);
    }

    if (!reduced) {
      // each card shrinks a little for every card that has slid over it
      cards.forEach((card, i) => {
        let depth = 0;
        for (let j = i + 1; j < cards.length; j++) {
          const r = cards[j].getBoundingClientRect();
          const stuckTop = parseFloat(getComputedStyle(cards[j]).top);
          const travel = vh - stuckTop;
          depth += Math.min(1, Math.max(0, (vh - r.top) / travel));
        }
        card.style.transform = depth ? `scale(${1 - depth * 0.035})` : "";
        card.style.filter = depth ? `brightness(${1 - depth * 0.12})` : "";
      });
    }
  };
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", request);
  onScroll();

  /* ---- carousel ---- */
  $$(".carousel").forEach((car) => {
    const track = $(".carousel-track", car);
    const count = $(".count", car);
    const total = track.children.length;
    const index = () => Math.round(track.scrollLeft / (track.clientWidth + 14));
    const update = () => { count.textContent = `${String(index() + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`; };
    const go = (dir) => {
      const next = (index() + dir + total) % total;
      track.scrollTo({ left: next * (track.clientWidth + 14), behavior: reduced ? "auto" : "smooth" });
    };
    $(".prev", car).addEventListener("click", () => go(-1));
    $(".next", car).addEventListener("click", () => go(1));
    track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    });
    update();
  });
})();
