import DefaultTheme from "vitepress/theme";
import "./custom.css";

let mermaidReady = false;
let lightboxBound = false;

function ensureLightbox() {
  if (typeof document === "undefined") return;
  if (document.getElementById("mermaid-lightbox")) return;

  const overlay = document.createElement("div");
  overlay.id = "mermaid-lightbox";
  overlay.className = "mermaid-lightbox";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="mermaid-lightbox__toolbar">
      <span class="mermaid-lightbox__hint">Scroll to pan · Esc or click outside to close</span>
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

function openLightbox(source: HTMLElement) {
  ensureLightbox();
  const overlay = document.getElementById("mermaid-lightbox")!;
  const stage = overlay.querySelector(".mermaid-lightbox__stage")!;
  const svg = source.querySelector("svg");
  if (!svg) return;

  stage.innerHTML = "";
  const clone = svg.cloneNode(true) as SVGElement;
  clone.removeAttribute("width");
  clone.removeAttribute("height");
  clone.style.width = "auto";
  clone.style.height = "auto";
  clone.style.maxWidth = "none";
  stage.appendChild(clone);

  overlay.hidden = false;
  document.body.classList.add("mermaid-lightbox-open");
}

function enhanceDiagram(node: HTMLElement) {
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

  node.addEventListener("click", () => openLightbox(node));
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
      flowchart: { curve: "basis", useMaxWidth: false },
      sequence: {
        actorMargin: 28,
        messageMargin: 40,
        mirrorActors: false,
        useMaxWidth: false,
        width: 180,
        height: 54,
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

  if (!lightboxBound) {
    lightboxBound = true;
  }
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
