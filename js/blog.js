// Render the author's LaTeX in the reading sections, leaving demo UI untouched.
if (typeof window.renderMathInElement === "function") {
    document.querySelectorAll(".post-text").forEach(section => {
        window.renderMathInElement(section, {
            delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "\\[", right: "\\]", display: true },
                { left: "\\(", right: "\\)", display: false },
                { left: "$", right: "$", display: false }
            ],
            throwOnError: false
        });
    });
}

// Keep arrival quiet, and only build a canvas when its demo is first opened.
const disclosures = [...document.querySelectorAll(".post-section, .blog-demo")];

function pauseDemos(container) {
    container.querySelectorAll("pin-spin-cat, bloch-sphere").forEach(demo => {
        demo.pause?.();
        demo.shadowRoot?.querySelectorAll("details[open]").forEach(detail => {
            detail.open = false;
        });
    });
}

function closeAllDemos() {
    disclosures.forEach(detail => { detail.open = false; });
    pauseDemos(document);
}

closeAllDemos();
// Browsers can restore disclosure state when returning with Back.
window.addEventListener("pageshow", closeAllDemos);
window.addEventListener("pagehide", () => pauseDemos(document));

disclosures.forEach(detail => {
    detail.addEventListener("toggle", () => {
        if (!detail.open) {
            detail.querySelectorAll("details[open]").forEach(child => { child.open = false; });
            pauseDemos(detail);
            return;
        }

        // Preserve one-at-a-time navigation in browsers without details[name].
        const group = detail.getAttribute("name");
        disclosures.forEach(sibling => {
            if (group && sibling !== detail && sibling.getAttribute("name") === group) {
                sibling.open = false;
            }
        });

        const section = detail.closest(".post-section");
        if (section && !section.open) return;
        const template = detail.querySelector(":scope > .demo-template");
        if (template) template.replaceWith(template.content.cloneNode(true));
    });
});
