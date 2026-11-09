import DefaultTheme from "vitepress/theme";
import "./custom.css";

let mermaidReady = false;

function ensureLightbox() {
  if (typeof document === "undefined") return;
  if (document.getElementById("mermaid-lightbox")) return;

  const overlay = document.createElement("div");
  overlay.id = "mermaid-lightbox";
  overlay.className = "mermaid-lightbox";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="mermaid-lightbox__toolbar">
      <span class="mermaid-lightbox__hint">Scroll to pan · Esc or Close to exit</span>
      <button type="button" class="mermaid-lightbox__close" aria-label="Close">Close</button>
    </div>
    <div class="mermaid-lightbox__stage"></div>
  `;
  document.body.appendChild(overlay);

  const close = () => {
    overlay.hidden = true;
    overlay.querySelector(".mermaid-lightbox__stage")!.innerHTML = "";
    document.body.classList.remove("mermaid-lightbox-open");
  };

  overlay
    .querySelector(".mermaid-lightbox__close")!
    .addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) close();
  });
}

function readSvgSize(svg: SVGElement): { width: number; height: number } | null {
  const viewBox = svg.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }

  try {
    const box = svg.getBBox();
    if (box.width > 0 && box.height > 0) {
      return { width: box.width, height: box.height };
    }
  } catch {
    // SVG not in DOM yet
  }

  return null;
}

/** Stop Mermaid from shrinking diagrams into the VitePress content column. */
function lockSvgNaturalSize(svg: SVGElement) {
  const size = readSvgSize(svg);
  if (!size) return size;

  const width = Math.ceil(size.width);
  const height = Math.ceil(size.height);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.style.width = `${width}px`;
  svg.style.height = `${height}px`;
  svg.style.maxWidth = "none";
  svg.removeAttribute("preserveAspectRatio");
  return size;
}

function openLightbox(source: HTMLElement) {
  ensureLightbox();
  const overlay = document.getElementById("mermaid-lightbox")!;
  const stage = overlay.querySelector(".mermaid-lightbox__stage")!;
  const svg = source.querySelector("svg");
  if (!svg) return;

  stage.innerHTML = "";
  const clone = svg.cloneNode(true) as SVGElement;
  const size = lockSvgNaturalSize(clone) ?? readSvgSize(svg);
  if (size) {
    // Fit width to the viewport when possible, keep aspect ratio, allow scroll if taller.
    const maxWidth = Math.max(960, window.innerWidth - 64);
    const scale = Math.min(1.35, maxWidth / size.width);
    clone.style.width = `${Math.round(size.width * scale)}px`;
    clone.style.height = `${Math.round(size.height * scale)}px`;
  }
  stage.appendChild(clone);

  overlay.hidden = false;
  document.body.classList.add("mermaid-lightbox-open");
}

function enhanceDiagram(node: HTMLElement) {
  const svg = node.querySelector("svg");
  if (svg) lockSvgNaturalSize(svg);

  if (node.dataset.lightboxReady === "1") return;
  node.dataset.lightboxReady = "1";
  node.classList.add("mermaid--zoomable");
  node.setAttribute("role", "button");
  node.setAttribute("tabindex", "0");
  node.setAttribute("title", "Click to enlarge");
  node.setAttribute("aria-label", "Diagram, click to enlarge");

  if (!node.querySelector(".mermaid__expand")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mermaid__expand";
    btn.textContent = "Expand";
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      openLightbox(node);
    });
    node.appendChild(btn);
  }

  node.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest(".mermaid__expand")) return;
    openLightbox(node);
  });
  node.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openLightbox(node);
    }
  });
}

async function renderMermaid() {
  if (typeof window === "undefined") return;

  ensureLightbox();
  const mermaid = (await import("mermaid")).default;

  if (!mermaidReady) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: document.documentElement.classList.contains("dark")
        ? "dark"
        : "neutral",
      flowchart: { curve: "basis", useMaxWidth: false, htmlLabels: true },
      sequence: {
        actorMargin: 36,
        messageMargin: 48,
        noteMargin: 12,
        mirrorActors: false,
        useMaxWidth: false,
        width: 168,
        height: 56,
        boxMargin: 12,
      },
    });
    mermaidReady = true;
  }

  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(".mermaid:not([data-processed])"),
  );
  if (nodes.length) {
    await mermaid.run({ nodes });
  }

  document
    .querySelectorAll<HTMLElement>(".mermaid[data-processed]")
    .forEach(enhanceDiagram);
}

export default {
  ...DefaultTheme,
  enhanceApp({ router }) {
    if (typeof window === "undefined") return;

    const schedule = () => {
      window.setTimeout(() => {
        void renderMermaid();
      }, 50);
    };

    schedule();
    router.onAfterRouteChanged = schedule;
  },
};
