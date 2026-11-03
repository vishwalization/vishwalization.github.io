# vishwalization.github.io

Personal site of A.K. Vishwanathan. Plain HTML, CSS and a little JavaScript; no build step.

## Files

- `index.html` — all page content
- `assets/css/style.css` — colours, type and layout (tokens at the top)
- `assets/js/bscan.js` — the simulated ToFD B-scan in the header
- `assets/img/` — publication thumbnails; add `profile.jpg` (4:5 portrait) here for the photo
- `assets/VishwanathanAK_CV.pdf` — the CV linked from the page

## Preview locally

```
cd ~/Documents/personal_website
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Publish on GitHub Pages

The repository must be named `vishwalization.github.io`. Push this folder to its `main` branch and
the site goes live at https://vishwalization.github.io (Settings → Pages → Deploy from branch → `main` / root).
