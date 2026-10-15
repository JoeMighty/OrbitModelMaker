<h1 align="center">Orbit Maker</h1>

<p align="center">
  A browser tool for building orbit models: a focus at the centre, concentric rings
  for how close something is, and items placed in those rings and coloured by group.
  <br>
  Pick a design, then export a vector PDF in A4, A3, A2, A1 or A0.
</p>

<p align="center">
  <img alt="HTML5" src="https://img.shields.io/badge/HTML5-E34F26?style=plastic&logo=html5&logoColor=white">
  <img alt="CSS3" src="https://img.shields.io/badge/CSS3-1572B6?style=plastic&logo=css3&logoColor=white">
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-F7DF1E?style=plastic&logo=javascript&logoColor=black">
  <img alt="Vanilla JS, no framework" src="https://img.shields.io/badge/framework-none-4c1?style=plastic">
  <img alt="No build step" src="https://img.shields.io/badge/build%20step-none-4c1?style=plastic">
</p>

<p align="center">
  <img alt="jsPDF 2.5.1" src="https://img.shields.io/badge/jsPDF-2.5.1-c7254e?style=plastic">
  <img alt="svg2pdf.js 2.2.4" src="https://img.shields.io/badge/svg2pdf.js-2.2.4-6e4c9e?style=plastic">
  <img alt="SVG" src="https://img.shields.io/badge/SVG-FFB13B?style=plastic&logo=svg&logoColor=black">
  <img alt="Output is vector PDF" src="https://img.shields.io/badge/output-vector%20PDF-informational?style=plastic">
  <img alt="Paper sizes A4 to A0" src="https://img.shields.io/badge/paper-A4%20to%20A0-informational?style=plastic">
</p>

<p align="center">
  <img alt="Runs entirely in the browser" src="https://img.shields.io/badge/backend-none-4c1?style=plastic">
  <img alt="Data stored in localStorage" src="https://img.shields.io/badge/storage-localStorage-blue?style=plastic">
  <img alt="Deployed on GitHub Pages" src="https://img.shields.io/badge/GitHub%20Pages-222222?style=plastic&logo=githubpages&logoColor=white">
</p>

No backend, no build step, no accounts. One HTML file, one stylesheet, one script.

## What an orbit model is

The centre is your focus: a community, a brand, a project, a team. Each ring is a
level of involvement, for example Core, Active, Casual and Observers. Items sit in
the ring that matches how close they are, and their colour shows which group they
belong to.

## Starter models

New opens a menu of ready made models, so you can start from something rather
than an empty page. Each one uses a different design, and each is a different
reading of the same idea:

| Template | What it shows |
|---|---|
| Blank model | Four rings, one group, nothing placed |
| Community orbit | Members, partners and volunteers around a group |
| Sector horizon scan | Now, five years and ten years, with signals clustered by theme |
| Product and customers | Accounts by how much they actually use the product |
| Brand and audience | Advocates out to people who have merely heard of you |
| Project stakeholders | Who decides, who influences, who is only told |
| Personal network | The people around you, by how often you really speak |
| Partner ecosystem | Resellers, integrations and suppliers around a platform |

Each one is a normal model once created, so rename it, repaint it and drag it
about. The first time you open the site you get the community orbit, ready to
edit.

## Features

- Two to six rings, with your own names
- Any number of groups, each with its own colour
- Six designs: Classic, Midnight, Blueprint, Mono, Pastel and Solar
- Portrait or landscape
- Drag an item in the preview to move it between rings, or set its ring in the list
- Vector PDF export, so an A0 print stays sharp and the file stays small
- JSON backup and restore, so you can move your models between browsers
- Several models side by side, switched from the dropdown
- Eight starting points, from blank to seven worked examples
- Up to five names credited on the map
- A font for each role: headings, subheadings, body and captions
- An optional image in the top corner, a logo or a group mark
- Items in and out as CSV, so a group can draft in a shared spreadsheet

## Horizon scanning with the Orbit

The rings do not have to mean closeness. For a horizon scan, use them as time:
Now, five years, ten years. Signals go in the ring where they start to matter,
and groups become your themes, so the colour of a dot tells you which theme it
belongs to. The Sector horizon scan template is set up that way already, with
three rings and five themes.

A workable order for a group:

1. Start from the Sector horizon scan template and rename the centre to your
   sector or discipline.
2. Agree your themes, and set them up as groups with a colour each.
3. Each person researches a horizon or a theme and adds their signals to a
   shared spreadsheet, one row per signal.
4. Download the CSV from the app to get the right column headings, fill it in
   together, then load it back.
5. Drag the dots until the clustering reads the way you want it to.
6. Add your names, pick a design, export the PDF at the size you need.

Keep the signal labels short. Anything over about 48 characters is trimmed on
the map, so put the detail and the source in your own notes rather than in the
label.

## Items as a spreadsheet

Download CSV gives you this model's items. If a model has no items yet, you get
an example file with the right ring and group names already in it, so it doubles
as a template to start from.

```
label,ring,group
AI in daily workflows,Now,Technology
Portfolio over CV,Five years,Skills and roles
Four day week,3,Ways of working
```

- `label` is the only column that has to be there.
- `ring` can be the ring name, or a number where 1 is the innermost ring. A
  name that does not exist yet is added as a new ring, up to six.
- `group` can be any theme name. A name that does not exist yet is added as a
  new group with the next colour in the palette.
- `angle` and `off` are optional. Leave them out and items are placed
  automatically, spread around their ring.
- Loading a CSV into a model that already has items asks whether to replace
  them or add alongside.

Up to 300 rows per file. Quoted fields and commas inside labels are handled.

## Fonts and images

Fonts are set per role, so headings, subheadings, body text and captions can
differ. Three families are offered: sans, serif and mono. These are the families
every PDF reader has built in, so an exported file looks the same on any machine
without embedding a font file and without bloating the page.

An image can be placed in the top left corner, for a logo or a group mark. PNG,
JPEG and WEBP are accepted. The picture is scaled down to 512 pixels before it
is stored, because browser storage is small, and it is embedded in the PDF as an
image while everything else stays vector.

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
`orbit-maker:v1`, images included. Nothing is uploaded anywhere. That means:

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
