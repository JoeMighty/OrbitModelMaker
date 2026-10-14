# Orbit Maker

A small browser tool for building orbit models: a focus at the centre, concentric
rings for how close something is, and items placed in those rings and coloured by
group. Pick a design, then export a vector PDF in A4, A3, A2, A1 or A0.

No backend, no build step, no accounts. One HTML file, one stylesheet, one script.

## What an orbit model is

The centre is your focus: a community, a brand, a project, a team. Each ring is a
level of involvement, for example Core, Active, Casual and Observers. Items sit in
the ring that matches how close they are, and their colour shows which group they
belong to.

## Features

- Two to six rings, with your own names
- Any number of groups, each with its own colour
- Six designs: Classic, Midnight, Blueprint, Mono, Pastel and Solar
- Portrait or landscape
- Drag an item in the preview to move it between rings, or set its ring in the list
- Vector PDF export, so an A0 print stays sharp and the file stays small
- JSON backup and restore, so you can move your models between browsers
- Several models side by side, switched from the dropdown

## Run it locally

Clone or download the repository, then serve the folder over HTTP:

```
python3 -m http.server
```

Open http://localhost:8000 in your browser.

Opening `index.html` straight from the file system mostly works, but a local
server is closer to how the published site behaves, so prefer it.

## Publish on GitHub Pages

1. Push the files to a GitHub repository.
2. Open the repository on GitHub and go to Settings, then Pages.
3. Under Build and deployment, set Source to "Deploy from a branch".
4. Choose the `main` branch and the `/ (root)` folder, then save.
5. Wait for the first deploy, then open the URL GitHub shows on that page.

All paths in the project are relative, so the site works from a repository
subpath such as `https://yourname.github.io/orbit-maker/`.

## Where your data lives

Everything is saved in your browser's localStorage, under the key
`orbit-maker:v1`. Nothing is uploaded anywhere. That means:

- Your models are per browser and per device, and are not shared between them.
- Clearing site data for the page, or using a private window, removes them.
- To move your work, use Save backup on one device and Load backup on the other.

If storage is blocked, the app still runs for the session, it just cannot
remember anything after a reload.

## Printing notes

The PDF is real vector output: text stays selectable and the background covers the
full page, so dark designs print edge to edge. Mono is the friendliest design for
a plain office printer, and Blueprint or Midnight suit a screen or a poster print.

## Libraries

Loaded from jsDelivr at runtime, nothing is bundled:

- jsPDF 2.5.1
- svg2pdf.js 2.2.4

If those scripts are blocked, the app still works and only PDF export is
unavailable. The JSON backup is unaffected.
