# Elliott Love's website

A small static website with a home page and a separate blog.

## Add a blog post

Open `blog.html` and add a complete `<article>` inside `<div class="blog-posts">`. Put each new article **above the older ones**, so readers scroll through full posts from newest to oldest. No build step or JavaScript is required.

```html
<article class="blog-post" id="a-short-post-slug">
    <time datetime="YYYY-MM-DD">Month Day, Year</time>
    <h2>Your post title</h2>
    <p>Your first paragraph.</p>
    <p>Your next paragraph.</p>
</article>
```

Replace the date and post slug with real values. Images can be included with `<img src="your-image.jpg" alt="Describe the image">`. Keep links and image paths relative so they work under the GitHub Pages project URL.

## Reflections, rotations, and spinors

The first post currently contains only its title and the interactive visualizations from `cat.zip`; the article text is left for Elliott to add in `blog.html`.

`js/pin-spin-cat.js` provides a self-contained custom element with Mirrors, Spin, and Kaleidoscope tabs. The script is hosted locally and needs no build step or external libraries. Its supplied license notice is preserved. Site colors and responsive sizing are set by `.blog-visualization` in `style.css`.

## Preview locally

From this folder, run `python3 -m http.server 8000`, then open `http://localhost:8000`.

## Publish

Commit the changed site files and push to `main`. The existing **Deploy static content to Pages** workflow publishes automatically. Check its progress in the repository's **Actions** tab.

If GitHub Pages needs to be enabled again, open the repository's **Settings → Pages**, set **Source** to **GitHub Actions**, and run the deployment workflow from **Actions**.
