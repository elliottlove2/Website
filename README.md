# Elliott Love's website

A small static website with a home page and a separate blog. Posts appear in full, newest first, with a full-width rule separating them.

## Write your post

The easiest way is to send Codex your paragraphs and LaTeX, saying where each part belongs—for example, “before the mirrors demo” or “after the spin demo.” The public page has no editor; writing is added to the site files and then published.

To edit directly, open `blog.html` and find the **WRITE HERE** comments inside the `.post-text` sections. Replace a comment with your writing, keeping the surrounding `<div class="post-text">` tags. The current post has spaces before, between, and after its three demos. Its exposition is intentionally unwritten.

Use `<p>` for each paragraph and `<h3>` for a section heading:

```html
<h3>Your section heading</h3>
<p>Your paragraph goes here, with inline math such as \(x^2\).</p>
<p>Your next paragraph goes here.</p>
```

Inside a `.post-text` section, use `\( ... \)` or `$ ... $` for inline equations, and `\[ ... \]` or `$$ ... $$` for display equations on their own line. KaTeX typesets them when the page loads. A display equation can sit between paragraphs:

```html
\[ a^2 + b^2 = c^2 \]
```

When entering text or LaTeX in raw HTML, write a literal `<` as `&lt;` and a literal `&` as `&amp;` (including alignment markers inside LaTeX). Keep actual HTML tags such as `<p>` unchanged. For example, enter `\(x &lt; y\)` for an inequality.

Add a Blog subtitle at the commented **Optional subtitle** spot near the top of `blog.html`, using `<p class="blog-subtitle">Your subtitle.</p>`.

## Place the demos

Each demo is an independent, expandable `<details class="blog-demo">` block containing one `<pin-spin-cat>` element. Move the **whole block**, from `<details ...>` through `</details>`, between `.post-text` sections to place it alongside your writing. Keep it outside the text `<div>` so it can use the wider demo layout.

Within a post, give all its demo blocks the same `name`, such as `reflections-demos`. The browser uses that name to keep only one demo open at a time. Use a different name for each post so opening a demo in one post does not close one in another. Add `open` to at most one block if you want a demo expanded initially.

Use the same single value for both `modes` and `mode`: `mirrors`, `spin`, or `kaleido`. This gives each block its own demo without mode tabs. The local `js/pin-spin-cat.js` file supplies the demos; its license notice is preserved.

## Add another post

Add a complete `<article>` inside `<div class="blog-posts">`, **above the older articles**. This template uses the same full-width rule, narrow reading column, and wider demo area. Replace the title, IDs, demo name, and labels for your post; omit the demo block if it is not needed.

```html
<article class="blog-post" id="a-short-post-slug" aria-labelledby="a-short-post-title">
    <header class="post-header">
        <h2 id="a-short-post-title">Your post title</h2>
    </header>

    <div class="post-text">
        <!-- WRITE HERE: paragraphs before the demo. -->
    </div>

    <details class="blog-demo" name="a-short-post-slug-demos">
        <summary>Interactive mirrors</summary>
        <pin-spin-cat class="blog-visualization" modes="mirrors" mode="mirrors" theme="light" aria-label="Interactive mirrors demo"></pin-spin-cat>
    </details>

    <div class="post-text">
        <!-- WRITE HERE: paragraphs after the demo. -->
    </div>
</article>
```

An optional date can go before the `<h2>` inside `.post-header`: `<time datetime="YYYY-MM-DD">Month Day, Year</time>`. Replace both date placeholders with your publication date. Images belong inside `.post-text`, for example `<img src="your-image.jpg" alt="Describe the image">`. Keep links and image paths relative so they work under the GitHub Pages project URL. No build step is required.

## Preview locally

From this folder, run `python3 -m http.server 8000`, then open `http://localhost:8000`.

## Publish

Commit the changed site files and push to `main`. The existing **Deploy static content to Pages** workflow publishes automatically. Check its progress in the repository's **Actions** tab.

If GitHub Pages needs to be enabled again, open the repository's **Settings → Pages**, set **Source** to **GitHub Actions**, and run the deployment workflow from **Actions**.
