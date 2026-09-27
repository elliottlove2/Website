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
