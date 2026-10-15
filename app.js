/* Orbit Maker
   Vanilla JS, no build step. One SVG builder feeds both the preview and the PDF,
   so what you see on screen is what gets printed. */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     constants
     ------------------------------------------------------------------ */

  var KEY = "orbit-maker:v1";

  var SIZES = { A4: [210, 297], A3: [297, 420], A2: [420, 594], A1: [594, 841], A0: [841, 1189] };

  var PALETTE = ["#e4572e", "#17a398", "#7b61ff", "#f5a623", "#2d9cdb", "#27ae60", "#eb5757", "#9b51e0"];

  var MARGIN = 30;          /* page margin in page units, labels stay inside it */
  var MIN_RINGS = 2;
  var MAX_RINGS = 6;

  var MAX_NAMES = 5;
  var MAX_CSV_ROWS = 300;

  /* Fonts must map to the built in PDF fonts for export. svg2pdf matches the
     family against the jsPDF font list, which is lower case, so these names are
     lower case too. The screen preview gets a fallback stack instead. Only these
     three families exist in every PDF reader without embedding a font file. */
  var FONTS = {
    helvetica: { label: "Sans", stack: "Helvetica, Arial, sans-serif" },
    times: { label: "Serif", stack: "Times New Roman, Times, serif" },
    courier: { label: "Mono", stack: "Courier New, Courier, monospace" }
  };

  /* Which pieces of text each font choice covers. */
  var ROLES = [
    { key: "heading", label: "Headings", note: "Title and centre" },
    { key: "subheading", label: "Subheadings", note: "Subtitle" },
    { key: "body", label: "Body", note: "Item labels" },
    { key: "caption", label: "Captions", note: "Rings, legend, names" }
  ];

  var THEMES = {
    classic: {
      name: "Classic",
      bg: "#faf8f3",
      bands: ["#e7dbc6", "#ece2d2", "#f1e9db", "#f5efe5", "#f8f4ec", "#fbf9f4"],
      line: "#b9a98f", lineW: 1.2, dash: null,
      text: "#2e2a24", muted: "#8a7f6d",
      centerFill: "#2e2a24", centerText: "#faf8f3",
      dot: "#faf8f3", spoke: null, font: "times"
    },
    midnight: {
      name: "Midnight",
      bg: "#0a0e1f",
      bands: ["#1d2856", "#19234b", "#141c40", "#111735", "#0e122a", "#0a0e1f"],
      line: "#7c8cf0", lineW: 1, dash: null,
      text: "#e8ecff", muted: "#9aa6d8",
      centerFill: "#f0c14b", centerText: "#1a1402",
      dot: "#0a0e1f", spoke: "#2b3568", font: "helvetica"
    },
    blueprint: {
      name: "Blueprint",
      bg: "#0b4f9c",
      bands: ["#1463bf", "#1260b8", "#105cb0", "#0f58a8", "#0d54a1", "#0c5099"],
      line: "#ffffff", lineW: 1, dash: "6 6",
      text: "#ffffff", muted: "#c3dbf6",
      centerFill: "#ffffff", centerText: "#0b4f9c",
      dot: "#0b4f9c", spoke: "#64a0da", font: "courier"
    },
    mono: {
      name: "Mono",
      bg: "#ffffff",
      bands: ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"],
      line: "#000000", lineW: 1.6, dash: null,
      text: "#000000", muted: "#6b6b6b",
      centerFill: "#000000", centerText: "#ffffff",
      dot: "#141414", spoke: "#cccccc", font: "helvetica"
    },
    pastel: {
      name: "Pastel",
      bg: "#ffffff",
      bands: ["#ffd8e0", "#ffe7cd", "#fdf3c6", "#d7efd5", "#d1e7f7", "#e2dbf5"],
      line: "#ffffff", lineW: 5, dash: null,
      text: "#3a3a46", muted: "#7b7b8a",
      centerFill: "#3a3a46", centerText: "#ffffff",
      dot: "#ffffff", spoke: null, font: "helvetica"
    },
    solar: {
      name: "Solar",
      bg: "#fff3dc",
      bands: ["#ef8a2c", "#f3a048", "#f6b56e", "#f9cc98", "#fcddbd", "#fff0da"],
      line: "#ffffff", lineW: 1.5, dash: null,
      text: "#4a2c0d", muted: "#8a5a22",
      centerFill: "#4a2c0d", centerText: "#fff3dc",
      dot: "#fff3dc", spoke: null, font: "times"
    }
  };

  var DESIGN_KEYS = Object.keys(THEMES);

  /* ------------------------------------------------------------------
     small helpers
     ------------------------------------------------------------------ */

  function uid() {
    return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : d; }
  function r2(n) { return Math.round(n * 100) / 100; }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  function slug(s) {
    var t = String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return t.slice(0, 48) || "orbit-model";
  }
  function str(v, d, max) { return typeof v === "string" ? v.slice(0, max) : d; }
  function color(v, d) {
    if (typeof v !== "string") return d;
    var s = v.trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(s)) return ("#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase();
    return d;
  }
  /* shortest signed distance between two angles in degrees */
  function angDiff(a, b) { return ((a - b) % 360 + 540) % 360 - 180; }

  /* Wrap to lines of at most max characters, at most maxLines, ASCII ellipsis. */
  function wrapText(s, max, maxLines) {
    var words = String(s == null ? "" : s).trim().split(/\s+/).filter(Boolean);
    var out = [], line = "", i, w, test;
    for (i = 0; i < words.length; i++) {
      w = words[i];
      while (w.length > max) {                       /* hard split a very long word */
        if (line) { out.push(line); line = ""; }
        out.push(w.slice(0, max));
        w = w.slice(max);
      }
      if (!w) continue;
      test = line ? line + " " + w : w;
      if (test.length <= max) line = test;
      else { if (line) out.push(line); line = w; }
    }
    if (line) out.push(line);
    if (!out.length) return [];
    if (maxLines && out.length > maxLines) {
      var keep = out.slice(0, maxLines);
      var last = keep[maxLines - 1];
      if (last.length > max - 3) last = last.slice(0, Math.max(0, max - 3)).replace(/\s+$/, "");
      keep[maxLines - 1] = last + "...";
      return keep;
    }
    return out;
  }

  /* One text element per line, explicit x and y, no tspan, no baseline tricks. */
  function tx(x, y, s, o) {
    var a = '<text x="' + r2(x) + '" y="' + r2(y) + '" font-family="' + o.font +
      '" font-size="' + o.size + '" fill="' + o.fill + '"';
    if (o.anchor) a += ' text-anchor="' + o.anchor + '"';
    if (o.weight) a += ' font-weight="' + o.weight + '"';
    return a + ">" + esc(s) + "</text>";
  }
  /* A block of lines, centred vertically on yMid. */
  function block(lines, x, yMid, lh, o) {
    var out = [], top = yMid - ((lines.length - 1) * lh) / 2, i;
    for (i = 0; i < lines.length; i++) out.push(tx(x, top + i * lh + o.size * 0.35, lines[i], o));
    return out.join("");
  }

  /* ------------------------------------------------------------------
     model
     ------------------------------------------------------------------ */

  function normalize(raw) {
    if (!raw || typeof raw !== "object") return null;
    var m = {};
    m.id = (typeof raw.id === "string" && raw.id) ? raw.id : uid();
    m.title = str(raw.title, "Untitled model", 120);
    m.subtitle = str(raw.subtitle, "", 160);
    m.center = str(raw.center, "Us", 40);
    m.design = THEMES[raw.design] ? raw.design : "classic";
    m.orientation = raw.orientation === "landscape" ? "landscape" : "portrait";
    m.labelSize = Math.round(clamp(num(raw.labelSize, 18), 12, 30));

    m.names = (Array.isArray(raw.names) ? raw.names : [])
      .filter(function (x) { return typeof x === "string" && x.trim(); })
      .map(function (x) { return x.trim().slice(0, 40); })
      .slice(0, MAX_NAMES);

    var rf = (raw.fonts && typeof raw.fonts === "object") ? raw.fonts : {};
    m.fonts = {};
    ROLES.forEach(function (r) { m.fonts[r.key] = FONTS[rf[r.key]] ? rf[r.key] : ""; });

    /* Only raster data URIs. An SVG data URI can carry script, and the PDF
       library cannot rasterise one anyway. */
    m.logo = (typeof raw.logo === "string" &&
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw.logo) &&
      raw.logo.length < 2500000) ? raw.logo : "";

    var rings = Array.isArray(raw.rings) ? raw.rings.map(function (r) { return str(r, "Ring", 40); }) : [];
    if (rings.length < MIN_RINGS) rings = ["Core", "Active", "Casual", "Observers"];
    m.rings = rings.slice(0, MAX_RINGS);

    var groups = (Array.isArray(raw.groups) ? raw.groups : [])
      .filter(function (g) { return g && typeof g === "object"; })
      .map(function (g, i) {
        return {
          id: (typeof g.id === "string" && g.id) ? g.id : uid(),
          name: str(g.name, "Group " + (i + 1), 40),
          color: color(g.color, PALETTE[i % PALETTE.length])
        };
      });
    if (!groups.length) groups = [{ id: uid(), name: "Group 1", color: PALETTE[0] }];
    m.groups = groups;

    var known = {};
    groups.forEach(function (g) { known[g.id] = true; });
    m.items = (Array.isArray(raw.items) ? raw.items : [])
      .filter(function (it) { return it && typeof it === "object"; })
      .map(function (it) {
        return {
          id: (typeof it.id === "string" && it.id) ? it.id : uid(),
          label: str(it.label, "Item", 60),
          ring: Math.round(clamp(num(it.ring, 0), 0, m.rings.length - 1)),
          group: known[it.group] ? it.group : groups[0].id,
          angle: ((num(it.angle, 0) % 360) + 360) % 360,
          off: clamp(num(it.off, 0.5), 0, 1)
        };
      });
    return m;
  }

  function freshIds(m) {
    m.id = uid();
    var map = {};
    m.groups.forEach(function (g) { var old = g.id; g.id = uid(); map[old] = g.id; });
    m.items.forEach(function (it) { it.id = uid(); it.group = map[it.group] || m.groups[0].id; });
    return m;
  }

  function blank() {
    return normalize({
      title: "Untitled model",
      subtitle: "",
      center: "Us",
      rings: ["Core", "Active", "Casual", "Observers"],
      groups: [{ name: "Group 1", color: PALETTE[0] }],
      items: []
    });
  }

  /* Starter models. Each one uses a different design and a different reading of
     the same idea: a focus at the centre, rings for closeness, colour by group. */
  var TEMPLATES = [
    {
      key: "community",
      name: "Community orbit",
      blurb: "Members, partners and volunteers",
      build: function () {
        return seeded({
          title: "Community Orbit Model",
          subtitle: "Who is close, and who is drifting",
          center: "Us", design: "classic", orientation: "portrait", labelSize: 18,
          rings: ["Core", "Active", "Casual", "Observers"],
          groups: [["Members", "#e4572e"], ["Partners", "#17a398"], ["Volunteers", "#7b61ff"]]
        }, [
          ["Founding team", 0, 0], ["Steering group", 0, 2],
          ["Weekly regulars", 1, 0], ["Local partner org", 1, 1], ["Event hosts", 1, 2],
          ["Newsletter readers", 2, 0], ["Funding body", 2, 1],
          ["Lapsed members", 3, 0], ["Local press", 3, 1]
        ]);
      }
    },
    {
      key: "horizon",
      name: "Sector horizon scan",
      blurb: "Now, five years, ten years, with signals clustered by theme",
      build: function () {
        return seeded({
          title: "Sector Orbit Map",
          subtitle: "Horizon scan: what is here now, next, and later",
          center: "Our sector", design: "mono", orientation: "portrait", labelSize: 17,
          rings: ["Now", "Five years", "Ten years"],
          groups: [["Technology", "#2d9cdb"], ["Skills and roles", "#e4572e"],
                   ["Ways of working", "#27ae60"], ["Business models", "#9b51e0"],
                   ["Policy and ethics", "#f5a623"]]
        }, [
          ["AI in daily workflows", 0, 0], ["Hybrid studio weeks", 0, 2],
          ["Freelance first teams", 0, 3], ["Clients building in house", 0, 3],
          ["Real time production", 1, 0], ["Portfolio over CV", 1, 1],
          ["Micro credentials", 1, 1], ["Sustainability reporting", 1, 4],
          ["Synthetic media norms", 2, 0], ["Four day week", 2, 2],
          ["Studio co ops", 2, 3], ["Regulated AI use", 2, 4]
        ]);
      }
    },
    {
      key: "product",
      name: "Product and customers",
      blurb: "Accounts by how much they use it",
      build: function () {
        return seeded({
          title: "Customer Orbit",
          subtitle: "How close each account is to the product",
          center: "Our product", design: "midnight", orientation: "portrait", labelSize: 18,
          rings: ["Daily", "Weekly", "Occasional", "At risk"],
          groups: [["Enterprise", "#2d9cdb"], ["Small business", "#27ae60"], ["Individual", "#f5a623"], ["Trials", "#eb5757"]]
        }, [
          ["Design partners", 0, 0], ["Power teams", 0, 1],
          ["Weekly teams", 1, 1], ["Solo subscribers", 1, 2], ["Agency accounts", 1, 0],
          ["Monthly logins", 2, 2], ["Pilot accounts", 2, 3],
          ["Expired trials", 3, 3], ["Quiet accounts", 3, 0]
        ]);
      }
    },
    {
      key: "brand",
      name: "Brand and audience",
      blurb: "Advocates out to the merely aware",
      build: function () {
        return seeded({
          title: "Audience Orbit",
          subtitle: "From advocates to the merely aware",
          center: "The brand", design: "solar", orientation: "portrait", labelSize: 18,
          rings: ["Advocates", "Buyers", "Followers", "Aware"],
          groups: [["Customers", "#c0392b"], ["Creators", "#7b61ff"], ["Press", "#17a398"], ["Community", "#2d9cdb"]]
        }, [
          ["Repeat buyers", 0, 0], ["Ambassadors", 0, 3],
          ["First time buyers", 1, 0], ["Gift buyers", 1, 0], ["Collaborators", 1, 1],
          ["Social followers", 2, 3], ["Newsletter list", 2, 0],
          ["Trade reviewers", 3, 2], ["Local press", 3, 2]
        ]);
      }
    },
    {
      key: "stakeholders",
      name: "Project stakeholders",
      blurb: "Who decides, who influences, who is told",
      build: function () {
        return seeded({
          title: "Stakeholder Map",
          subtitle: "Who decides, who influences, who is told",
          center: "The project", design: "blueprint", orientation: "landscape", labelSize: 17,
          rings: ["Decide", "Influence", "Affected", "Informed"],
          groups: [["Internal", "#f5a623"], ["Customers", "#2ecc71"], ["Suppliers", "#ff6b6b"], ["Regulators", "#d7c4ff"]]
        }, [
          ["Exec sponsor", 0, 0], ["Ops manager", 0, 0],
          ["Key account", 1, 1], ["Finance partner", 1, 0],
          ["Frontline staff", 2, 0], ["Logistics partner", 2, 2], ["Support team", 2, 0],
          ["Safety regulator", 3, 3], ["Local council", 3, 3]
        ]);
      }
    },
    {
      key: "personal",
      name: "Personal network",
      blurb: "People you know, by how often you speak",
      build: function () {
        return seeded({
          title: "My Orbit",
          subtitle: "The people around me, by how often we speak",
          center: "Me", design: "pastel", orientation: "portrait", labelSize: 19,
          rings: ["Inner circle", "Close", "Friendly", "Distant"],
          groups: [["Family", "#e4572e"], ["Friends", "#7b61ff"], ["Work", "#17a398"], ["Neighbours", "#f5a623"]]
        }, [
          ["Partner", 0, 0], ["Best friends", 0, 1],
          ["Siblings", 1, 0], ["Book club", 1, 1], ["Team at work", 1, 2],
          ["Old colleagues", 2, 2], ["Next door", 2, 3],
          ["Cousins", 3, 0], ["Gym crowd", 3, 1]
        ]);
      }
    },
    {
      key: "partners",
      name: "Partner ecosystem",
      blurb: "Resellers, integrations and suppliers",
      build: function () {
        return seeded({
          title: "Partner Ecosystem",
          subtitle: "Who builds on us, and how closely",
          center: "Our platform", design: "mono", orientation: "landscape", labelSize: 17,
          rings: ["Strategic", "Active", "Light touch", "Prospects"],
          groups: [["Resellers", "#e4572e"], ["Integrations", "#2d9cdb"], ["Agencies", "#7b61ff"], ["Suppliers", "#27ae60"]]
        }, [
          ["Lead reseller", 0, 0], ["Core integration", 0, 1],
          ["Regional partner", 1, 0], ["API partners", 1, 1], ["Design agency", 1, 2],
          ["Pilot integrations", 2, 1], ["Hosting supplier", 2, 3],
          ["Prospect list", 3, 0], ["Trade body", 3, 3]
        ]);
      }
    }
  ];

  /* Fill in the ids and spread the items around their rings. The small variation
     in off keeps a starter model from looking like a set of perfect circles. */
  function seeded(base, rows) {
    base.id = uid();
    base.groups = base.groups.map(function (g, i) { return { id: "g" + (i + 1), name: g[0], color: g[1] }; });
    base.items = [];
    rows.forEach(function (r, i) {
      base.items.push({
        id: uid(), label: r[0], ring: r[1], group: base.groups[r[2]].id,
        angle: pickAngle(base, r[1]), off: 0.4 + ((i * 2) % 5) * 0.05
      });
    });
    return base;
  }

  function fromTemplate(key) {
    var t = null;
    TEMPLATES.forEach(function (x) { if (x.key === key) t = x; });
    return t ? freshIds(normalize(t.build())) : blank();
  }

  function sample() { return fromTemplate("community"); }

  /* Angle that sits furthest from the items already in that ring, skipping the
     top axis where ring names are drawn. Ties are broken by moving away from the
     items in the other rings too, which keeps their labels from stacking up. */
  /* How far from the top axis an item has to sit to clear that ring's name.
     A tight inner ring needs a wider berth than a roomy outer one. */
  function topGap(model, ring) {
    var g = geom(model), b = bands(model);
    var r = b.r0 + b.bw * (clamp(ring, 0, b.n - 1) + 0.5);
    var half = (String(model.rings[ring] || "").length * 14 * 0.56) / 2 + 18;
    return clamp(Math.asin(clamp(half / r, 0, 1)) * 180 / Math.PI, 10, 40);
  }

  function pickAngle(model, ring) {
    var same = [], other = [], gap = topGap(model, ring), seed;
    model.items.forEach(function (it) { (it.ring === ring ? same : other).push(it.angle); });
    if (!same.length) {
      seed = (ring * 47 + 30) % 360;
      if (Math.abs(angDiff(seed, -90)) < gap) seed = (270 + gap + 8) % 360;
      return seed;
    }

    function nearest(a, list) {
      var d = 180, i;
      for (i = 0; i < list.length; i++) d = Math.min(d, Math.abs(angDiff(a, list[i])));
      return d;
    }
    var cand = [], all = [], a, top = -1;
    for (a = 0; a < 360; a += 3) {
      var d = nearest(a, same);
      all.push({ a: a, d: d });
      if (Math.abs(angDiff(a, -90)) < gap) continue;
      cand.push({ a: a, d: d });
      if (d > top) top = d;
    }
    if (!cand.length) {                               /* no room outside the names */
      cand = all;
      cand.forEach(function (c) { if (c.d > top) top = c.d; });
    }
    var best = null;
    cand.forEach(function (c) {
      if (c.d < top - 12) return;                /* near enough to the roomiest spot */
      var o = nearest(c.a, other);
      if (!best || o > best.o + 0.5 || (o > best.o - 0.5 && c.d > best.d)) best = { a: c.a, o: o, d: c.d };
    });
    return best ? best.a : 0;
  }

  /* ------------------------------------------------------------------
     state
     ------------------------------------------------------------------ */

  var state = { current: "", models: [] };
  var paper = "A4";

  function cur() {
    var m = null, i;
    for (i = 0; i < state.models.length; i++) if (state.models[i].id === state.current) m = state.models[i];
    if (!m) { m = state.models[0] || null; if (m) state.current = m.id; }
    return m;
  }
  function grp(m, id) {
    for (var i = 0; i < m.groups.length; i++) if (m.groups[i].id === id) return m.groups[i];
    return null;
  }
  function itm(m, id) {
    for (var i = 0; i < m.items.length; i++) if (m.items[i].id === id) return m.items[i];
    return null;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { return false; }   /* storage blocked or full, carry on in memory */
  }
  function load() {
    var raw = null, o, list;
    try { raw = localStorage.getItem(KEY); } catch (e) { return false; }
    if (!raw) return false;
    try { o = JSON.parse(raw); } catch (e) { return false; }
    if (!o || !Array.isArray(o.models)) return false;
    list = o.models.map(normalize).filter(Boolean);
    if (!list.length) return false;
    state.models = list;
    state.current = list[0].id;
    for (var i = 0; i < list.length; i++) if (list[i].id === o.current) state.current = o.current;
    return true;
  }

  /* ------------------------------------------------------------------
     geometry
     ------------------------------------------------------------------ */

  function geom(model) {
    return model.orientation === "landscape"
      ? { W: 1414, H: 1000, cx: 950, cy: 500, R: 320, land: true }
      : { W: 1000, H: 1414, cx: 500, cy: 745, R: 370, land: false };
  }
  function bands(model) {
    var g = geom(model), n = model.rings.length, r0 = 0.17 * g.R;
    return { r0: r0, bw: (g.R - r0) / n, n: n };
  }
  function bandColor(th, i, n) {
    return n <= 1 ? th.bands[0] : th.bands[Math.round((i * 5) / (n - 1))];
  }
  function itemPos(g, model, it) {
    var b = bands(model);
    var r = b.r0 + b.bw * (clamp(it.ring, 0, b.n - 1) + clamp(it.off, 0, 1));
    var a = (it.angle * Math.PI) / 180;
    return { x: g.cx + r * Math.cos(a), y: g.cy + r * Math.sin(a) };
  }

  /* ------------------------------------------------------------------
     the one SVG builder
     ------------------------------------------------------------------ */

  function buildSVG(model, screen) {
    var th = THEMES[model.design] || THEMES.classic;
    /* Each role falls back to the design's own font until it is set. */
    function fam(role) {
      var k = (model.fonts && FONTS[model.fonts[role]]) ? model.fonts[role] : th.font;
      if (!FONTS[k]) k = "helvetica";
      return screen ? FONTS[k].stack : k;
    }
    var f = { head: fam("heading"), sub: fam("subheading"), body: fam("body"), cap: fam("caption") };
    var font = f.body;
    var g = geom(model);
    var b = bands(model);
    var p = [], i, k, a, r;

    p.push('<rect x="0" y="0" width="' + g.W + '" height="' + g.H + '" fill="' + th.bg + '"/>');

    /* ring bands, outermost first so inner bands sit on top */
    for (i = b.n - 1; i >= 0; i--) {
      r = b.r0 + (i + 1) * b.bw;
      p.push('<circle cx="' + g.cx + '" cy="' + g.cy + '" r="' + r2(r) +
        '" fill="' + bandColor(th, i, b.n) + '" stroke="' + th.line + '" stroke-width="' + th.lineW + '"' +
        (th.dash ? ' stroke-dasharray="' + th.dash + '"' : "") + "/>");
    }

    /* spokes */
    if (th.spoke) {
      for (k = 0; k < 8; k++) {
        a = (k * 45 * Math.PI) / 180;
        p.push('<line x1="' + r2(g.cx + b.r0 * Math.cos(a)) + '" y1="' + r2(g.cy + b.r0 * Math.sin(a)) +
          '" x2="' + r2(g.cx + g.R * Math.cos(a)) + '" y2="' + r2(g.cy + g.R * Math.sin(a)) +
          '" stroke="' + th.spoke + '" stroke-width="1"/>');
      }
    }

    /* centre disc */
    p.push('<circle cx="' + g.cx + '" cy="' + g.cy + '" r="' + r2(b.r0) + '" fill="' + th.centerFill + '"/>');
    /* Wrap near nine characters, but never split a word that would still fit,
       and shrink the type instead so it stays inside the disc. */
    var cwords = String(model.center || "").split(/\s+/);
    var clong = 0;
    cwords.forEach(function (w) { if (w.length > clong) clong = w.length; });
    var cl = wrapText(model.center, clamp(clong, 9, 14), 3), cmax = 0, csize = 22;
    cl.forEach(function (l) { if (l.length > cmax) cmax = l.length; });
    if (cmax) csize = clamp((b.r0 * 1.75) / (cmax * 0.56), 11, 22);   /* keep it inside the disc */
    csize = Math.round(csize * 10) / 10;
    p.push(block(cl, g.cx, g.cy, csize * 1.18,
      { size: csize, font: f.head, fill: th.centerText, anchor: "middle", weight: "bold" }));

    /* ring names on the top axis, at each band middle */
    for (i = 0; i < b.n; i++) {
      r = b.r0 + (i + 0.5) * b.bw;
      p.push(tx(g.cx, g.cy - r + 5, model.rings[i], { size: 14, font: f.cap, fill: th.muted, anchor: "middle" }));
    }

    /* items */
    var gcol = {};
    model.groups.forEach(function (x) { gcol[x.id] = x.color; });

    model.items.forEach(function (it) {
      var pos = itemPos(g, model, it);
      var col = gcol[it.group] || model.groups[0].color;
      var ls = model.labelSize;
      var lines = wrapText(it.label, 16, 3);
      var maxc = 0, w, anchor, lx, s;
      lines.forEach(function (l) { if (l.length > maxc) maxc = l.length; });
      w = maxc * ls * 0.56;

      anchor = pos.x >= g.cx ? "start" : "end";
      lx = anchor === "start" ? pos.x + 16 : pos.x - 16;
      if (anchor === "start" && lx + w > g.W - MARGIN) { anchor = "end"; lx = pos.x - 16; }
      else if (anchor === "end" && lx - w < MARGIN) { anchor = "start"; lx = pos.x + 16; }

      s = "";
      if (screen) s += '<circle cx="' + r2(pos.x) + '" cy="' + r2(pos.y) + '" r="22" fill="none" pointer-events="all"/>';
      s += '<circle cx="' + r2(pos.x) + '" cy="' + r2(pos.y) + '" r="10" fill="' + col +
        '" stroke="' + th.dot + '" stroke-width="2.5"/>';
      if (lines.length) {
        s += block(lines, lx, pos.y, ls * 1.15, { size: ls, font: font, fill: th.text, anchor: anchor });
      }
      p.push(screen
        ? '<g data-id="' + esc(it.id) + '" style="cursor:grab;touch-action:none">' + s + "</g>"
        : "<g>" + s + "</g>");
    });

    /* optional image, top left in both orientations */
    if (model.logo) {
      var box = g.land ? 104 : 88;
      p.push('<image href="' + esc(model.logo) + '" xlink:href="' + esc(model.logo) + '" x="70" y="' +
        (g.land ? 62 : 56) + '" width="' + box + '" height="' + box + '" preserveAspectRatio="xMidYMid meet"/>');
    }

    /* header and legend */
    p.push(g.land ? headLandscape(model, th, f, g) : headPortrait(model, th, f, g));

    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" viewBox="0 0 ' + g.W + " " + g.H +
      '" width="' + g.W + '" height="' + g.H + '"' +
      (screen ? ' preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:100%;touch-action:none"' : "") +
      ">" + p.join("") + "</svg>";
  }

  function headPortrait(model, th, f, g) {
    /* A logo sits top left, so the centred title wraps earlier to clear it. */
    var p = [], t = wrapText(model.title, model.logo ? 22 : 30, 2), lh = 57, y = 105;
    if (t.length) {
      p.push(block(t, g.W / 2, y, lh, { size: 52, font: f.head, fill: th.text, anchor: "middle", weight: "bold" }));
      y = y + ((t.length - 1) * lh) / 2 + 26;
    }
    var sub = wrapText(model.subtitle, 56, 2);
    if (sub.length) {
      y = y + 28 + ((sub.length - 1) * 29) / 2;
      p.push(block(sub, g.W / 2, y, 29, { size: 24, font: f.sub, fill: th.muted, anchor: "middle" }));
      y = y + ((sub.length - 1) * 29) / 2;
    }
    var who = wrapText(model.names.join(", "), 62, 2);
    if (who.length) {
      p.push(block(who, g.W / 2, y + 30 + ((who.length - 1) * 23) / 2, 23,
        { size: 19, font: f.cap, fill: th.muted, anchor: "middle" }));
    }
    p.push(legend(model, th, f.cap, { x: g.W / 2, bottom: g.H - 80, width: g.W - 120, center: true }));
    return p.join("");
  }

  function headLandscape(model, th, f, g) {
    var p = [], t = wrapText(model.title, 17, 4), lh = 48, y = model.logo ? 230 : 190, i;
    for (i = 0; i < t.length; i++) {
      p.push(tx(70, y + i * lh, t[i], { size: 44, font: f.head, fill: th.text, anchor: "start", weight: "bold" }));
    }
    if (t.length) y += (t.length - 1) * lh + 46;
    var sub = wrapText(model.subtitle, 40, 3);
    for (i = 0; i < sub.length; i++) {
      p.push(tx(70, y + i * 27, sub[i], { size: 22, font: f.sub, fill: th.muted, anchor: "start" }));
    }
    if (sub.length) y += (sub.length - 1) * 27 + 44;
    var who = wrapText(model.names.join(", "), 46, 3);
    for (i = 0; i < who.length; i++) {
      p.push(tx(70, y + i * 24, who[i], { size: 19, font: f.cap, fill: th.muted, anchor: "start" }));
    }
    if (who.length) y += (who.length - 1) * 24 + 46;
    p.push(legend(model, th, f.cap, { x: 70, top: y, width: 440, center: false }));
    return p.join("");
  }

  /* Swatch plus name, flowing into rows inside o.width. */
  function legend(model, th, font, o) {
    var size = 20, rowH = 34, gap = 26;
    var rows = [], row = [], rw = 0, p = [];
    model.groups.forEach(function (gr) {
      var w = 28 + String(gr.name == null ? "" : gr.name).length * size * 0.56;
      var need = row.length ? rw + gap + w : w;
      if (row.length && need > o.width) { rows.push({ items: row, w: rw }); row = []; rw = w; }
      else rw = need;
      row.push({ g: gr, w: w });
    });
    if (row.length) rows.push({ items: row, w: rw });

    var top = o.top != null ? o.top : o.bottom - rows.length * rowH;
    rows.forEach(function (R, ri) {
      var yc = top + ri * rowH + rowH / 2;
      var x = o.center ? o.x - R.w / 2 : o.x;
      R.items.forEach(function (e) {
        p.push('<circle cx="' + r2(x + 9) + '" cy="' + r2(yc) + '" r="9" fill="' + e.g.color +
          '" stroke="' + th.dot + '" stroke-width="2"/>');
        p.push(tx(x + 28, yc + size * 0.35, e.g.name, { size: size, font: font, fill: th.text, anchor: "start" }));
        x += e.w + gap;
      });
    });
    return p.join("");
  }

  function thumb(th) {
    return '<svg viewBox="0 0 60 60" width="60" height="60" aria-hidden="true">' +
      '<rect x="0" y="0" width="60" height="60" fill="' + th.bg + '"/>' +
      '<circle cx="30" cy="30" r="24" fill="' + th.bands[5] + '" stroke="' + th.line + '" stroke-width="1"/>' +
      '<circle cx="30" cy="30" r="16" fill="' + th.bands[2] + '" stroke="' + th.line + '" stroke-width="1"/>' +
      '<circle cx="30" cy="30" r="8" fill="' + th.centerFill + '"/></svg>';
  }

  /* ------------------------------------------------------------------
     DOM
     ------------------------------------------------------------------ */

  function $(s) { return document.querySelector(s); }

  var panel = $("#panel"), sheet = $("#sheet"), modelSelect = $("#modelSelect"),
    designGrid = $("#designGrid"), ringList = $("#ringList"), groupList = $("#groupList"),
    itemList = $("#itemList"), newLabel = $("#newLabel"), newRing = $("#newRing"),
    newGroup = $("#newGroup"), paperSize = $("#paperSize"), exportInfo = $("#exportInfo"),
    pdfBtn = $("#pdfBtn"), importFile = $("#importFile"), labelSizeVal = $("#labelSizeVal"),
    newBtn = $("#newBtn"), newMenu = $("#newMenu"), nameList = $("#nameList"),
    nameCount = $("#nameCount"), fontGrid = $("#fontGrid"), logoFile = $("#logoFile"),
    csvFile = $("#csvFile"), csvNote = $("#csvNote");

  /* The New button opens a list of starter models. Blank stays the first entry,
     so the quickest path is still one click and one more. */
  function buildMenu() {
    newMenu.innerHTML =
      '<button type="button" role="menuitem" data-act="new-model" data-v="blank">' +
      '<span class="mt">Blank model</span><span class="mb">Four rings, one group, no items</span></button><hr>' +
      TEMPLATES.map(function (t) {
        return '<button type="button" role="menuitem" data-act="new-model" data-v="' + esc(t.key) + '">' +
          '<span class="mt">' + esc(t.name) + '</span><span class="mb">' + esc(t.blurb) + '</span></button>';
      }).join("");
  }

  function setMenu(open) {
    newMenu.hidden = !open;
    newBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function renderPreview() {
    var m = cur();
    if (!m) return;
    var g = geom(m);
    sheet.style.setProperty("--ar", String(r2(g.W / g.H)));
    sheet.innerHTML = buildSVG(m, true);
    wireDrag(sheet.querySelector("svg"));
  }

  function ringOpts(m, sel) {
    return m.rings.map(function (r, i) {
      return '<option value="' + i + '"' + (i === sel ? " selected" : "") + ">" + (i + 1) + ". " + esc(r) + "</option>";
    }).join("");
  }
  function groupOpts(m, sel) {
    return m.groups.map(function (gr) {
      return '<option value="' + esc(gr.id) + '"' + (gr.id === sel ? " selected" : "") + ">" + esc(gr.name) + "</option>";
    }).join("");
  }

  function renderForm() {
    var m = cur();
    if (!m) return;

    modelSelect.innerHTML = state.models.map(function (x) {
      return '<option value="' + esc(x.id) + '"' + (x.id === m.id ? " selected" : "") + ">" +
        esc(x.title || "Untitled model") + "</option>";
    }).join("");

    panel.querySelector('[data-bind="title"]').value = m.title;
    panel.querySelector('[data-bind="subtitle"]').value = m.subtitle;
    panel.querySelector('[data-bind="center"]').value = m.center;
    panel.querySelector('[data-bind="labelSize"]').value = String(m.labelSize);
    labelSizeVal.textContent = m.labelSize + " pt";

    designGrid.innerHTML = DESIGN_KEYS.map(function (k) {
      var th = THEMES[k];
      return '<button type="button" class="design" data-act="design" data-v="' + k +
        '" aria-pressed="' + (m.design === k ? "true" : "false") + '">' + thumb(th) +
        "<span>" + esc(th.name) + "</span></button>";
    }).join("");

    Array.prototype.forEach.call(panel.querySelectorAll('.seg button[data-act="orient"]'), function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-v") === m.orientation ? "true" : "false");
    });

    ringList.innerHTML = m.rings.map(function (r, i) {
      return '<div class="row ring"><span class="n">' + (i + 1) + "</span>" +
        '<input type="text" value="' + esc(r) + '" data-f="ring" data-i="' + i +
        '" maxlength="40" autocomplete="off" aria-label="Ring ' + (i + 1) + ' name">' +
        '<button type="button" class="icon" data-act="del-ring" data-i="' + i +
        '" aria-label="Delete ring ' + (i + 1) + '" title="Delete ring"' +
        (m.rings.length <= MIN_RINGS ? " disabled" : "") + ">x</button></div>";
    }).join("");

    groupList.innerHTML = m.groups.map(function (gr) {
      return '<div class="row group">' +
        '<input type="color" value="' + esc(gr.color) + '" data-f="gcolor" data-id="' + esc(gr.id) +
        '" aria-label="Colour for ' + esc(gr.name) + '">' +
        '<input type="text" value="' + esc(gr.name) + '" data-f="gname" data-id="' + esc(gr.id) +
        '" maxlength="40" autocomplete="off" aria-label="Group name">' +
        '<button type="button" class="icon" data-act="del-group" data-id="' + esc(gr.id) +
        '" aria-label="Delete group" title="Delete group"' +
        (m.groups.length <= 1 ? " disabled" : "") + ">x</button></div>";
    }).join("");

    var kr = Math.round(num(newRing.value, 0));
    if (!(kr >= 0 && kr < m.rings.length)) kr = 0;
    var kg = newGroup.value;
    if (!grp(m, kg)) kg = m.groups[0].id;
    newRing.innerHTML = ringOpts(m, kr);
    newGroup.innerHTML = groupOpts(m, kg);

    itemList.innerHTML = m.items.length
      ? m.items.map(function (it) {
        return '<div class="row item">' +
          '<input type="text" value="' + esc(it.label) + '" data-f="label" data-id="' + esc(it.id) +
          '" maxlength="60" autocomplete="off" aria-label="Item name">' +
          '<select data-f="iring" data-id="' + esc(it.id) + '" aria-label="Ring for ' + esc(it.label) + '">' +
          ringOpts(m, it.ring) + "</select>" +
          '<select data-f="igroup" data-id="' + esc(it.id) + '" aria-label="Group for ' + esc(it.label) + '">' +
          groupOpts(m, it.group) + "</select>" +
          '<button type="button" class="icon" data-act="del-item" data-id="' + esc(it.id) +
          '" aria-label="Delete item" title="Delete item">x</button></div>';
      }).join("")
      : '<p class="hint">No items yet. Add one above.</p>';

    nameList.innerHTML = m.names.map(function (n, i) {
      return '<div class="row name"><input type="text" value="' + esc(n) + '" data-f="name" data-i="' + i +
        '" maxlength="40" autocomplete="off" aria-label="Name ' + (i + 1) + '">' +
        '<button type="button" class="icon" data-act="del-name" data-i="' + i +
        '" aria-label="Remove name" title="Remove name">x</button></div>';
    }).join("");
    nameCount.textContent = m.names.length + " of " + MAX_NAMES;
    panel.querySelector('[data-act="add-name"]').disabled = m.names.length >= MAX_NAMES;

    fontGrid.innerHTML = ROLES.map(function (r) {
      var sel = m.fonts[r.key] || "";
      var opts = '<option value=""' + (sel ? "" : " selected") + ">Match design</option>" +
        Object.keys(FONTS).map(function (k) {
          return '<option value="' + k + '"' + (sel === k ? " selected" : "") + ">" + esc(FONTS[k].label) + "</option>";
        }).join("");
      return '<div><label for="font-' + r.key + '">' + esc(r.label) + "</label>" +
        '<select id="font-' + r.key + '" data-f="font" data-r="' + r.key +
        '" title="' + esc(r.note) + '">' + opts + "</select></div>";
    }).join("");

    panel.querySelector('[data-act="del-logo"]').disabled = !m.logo;
    panel.querySelector('[data-act="pick-logo"]').textContent = m.logo ? "Replace image" : "Choose image";

    panel.querySelector('[data-act="add-ring"]').disabled = m.rings.length >= MAX_RINGS;

    updateExportInfo();
  }

  /* Ring and group names appear in the pickers too. Retitle the existing options
     in place rather than rebuilding the form, which would drop focus mid typing
     and pull the row out from under a pointer that is on its way to a button. */
  function refreshOptions(m) {
    Array.prototype.forEach.call(panel.querySelectorAll('#newRing, select[data-f="iring"]'), function (sel) {
      for (var i = 0; i < sel.options.length && i < m.rings.length; i++) {
        sel.options[i].textContent = (i + 1) + ". " + m.rings[i];
      }
    });
    Array.prototype.forEach.call(panel.querySelectorAll('#newGroup, select[data-f="igroup"]'), function (sel) {
      for (var i = 0; i < sel.options.length; i++) {
        var gr = grp(m, sel.options[i].value);
        if (gr) sel.options[i].textContent = gr.name;
      }
    });
  }

  function renderAll() { renderForm(); renderPreview(); }

  function updateExportInfo() {
    var m = cur();
    if (!m) return;
    var d = SIZES[paper] || SIZES.A4;
    var land = m.orientation === "landscape";
    exportInfo.textContent = paper + " " + (land ? "landscape" : "portrait") + ", " +
      (land ? d[1] : d[0]) + " x " + (land ? d[0] : d[1]) + " mm";
  }

  /* ------------------------------------------------------------------
     events
     ------------------------------------------------------------------ */

  function onInput(e) {
    var t = e.target, m = cur();
    if (!m || !t.getAttribute) return;
    var bind = t.getAttribute("data-bind"), f, i, o, gr, it;

    if (bind) {
      if (bind === "labelSize") {
        m.labelSize = Math.round(clamp(num(t.value, 18), 12, 30));
        labelSizeVal.textContent = m.labelSize + " pt";
      } else {
        m[bind] = t.value;
        if (bind === "title") {
          o = modelSelect.options[modelSelect.selectedIndex];
          if (o) o.textContent = t.value || "Untitled model";
        }
      }
      save(); renderPreview();
      return;
    }

    f = t.getAttribute("data-f");
    if (!f) return;
    if (f === "ring") {
      i = Math.round(num(t.getAttribute("data-i"), -1));
      if (i < 0 || i >= m.rings.length) return;
      m.rings[i] = t.value;
      refreshOptions(m);
    } else if (f === "gname" || f === "gcolor") {
      gr = grp(m, t.getAttribute("data-id"));
      if (!gr) return;
      if (f === "gname") { gr.name = t.value; refreshOptions(m); }
      else gr.color = color(t.value, gr.color);
    } else if (f === "label") {
      it = itm(m, t.getAttribute("data-id"));
      if (!it) return;
      it.label = t.value;
    } else if (f === "name") {
      i = Math.round(num(t.getAttribute("data-i"), -1));
      if (i < 0 || i >= m.names.length) return;
      m.names[i] = t.value;
    } else return;
    save(); renderPreview();
  }

  function onChange(e) {
    var t = e.target, m = cur(), f, it;
    if (t === modelSelect) { state.current = t.value; note(""); save(); renderAll(); return; }
    if (t === paperSize) { paper = t.value; updateExportInfo(); return; }
    if (t === importFile) { readImport(t.files && t.files[0]); t.value = ""; return; }
    if (t === logoFile) { readLogo(t.files && t.files[0]); t.value = ""; return; }
    if (t === csvFile) { readCSV(t.files && t.files[0]); t.value = ""; return; }
    if (!m || !t.getAttribute) return;
    f = t.getAttribute("data-f");
    if (f === "iring") {
      it = itm(m, t.getAttribute("data-id"));
      if (it) { it.ring = Math.round(clamp(num(t.value, 0), 0, m.rings.length - 1)); save(); renderPreview(); }
    } else if (f === "igroup") {
      it = itm(m, t.getAttribute("data-id"));
      if (it && grp(m, t.value)) { it.group = t.value; save(); renderPreview(); }
    } else if (f === "font") {
      var role = t.getAttribute("data-r");
      if (m.fonts.hasOwnProperty(role)) {
        m.fonts[role] = FONTS[t.value] ? t.value : "";
        save(); renderPreview();
      }
    }
  }

  function onClick(e) {
    var b = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!b || b.disabled) return;
    var act = b.getAttribute("data-act"), m = cur(), i, id, x, gone, keep, used, n;

    if (act === "new-menu") { setMenu(newMenu.hidden); return; }
    if (act === "new-model") {
      setMenu(false);
      id = b.getAttribute("data-v");
      x = (id && id !== "blank") ? fromTemplate(id) : blank();
      state.models.push(x); state.current = x.id; save(); renderAll(); return;
    }
    if (!m) return;

    switch (act) {
      case "dup-model":
        x = freshIds(normalize(JSON.parse(JSON.stringify(m))));
        x.title = (m.title || "Untitled model") + " copy";
        state.models.push(x); state.current = x.id;
        save(); renderAll();
        break;

      case "del-model":
        if (!window.confirm('Delete the model "' + (m.title || "Untitled model") + '"? This cannot be undone.')) return;
        state.models = state.models.filter(function (y) { return y.id !== m.id; });
        if (!state.models.length) state.models.push(blank());
        state.current = state.models[0].id;
        save(); renderAll();
        break;

      case "add-item":
        addItem();
        break;

      case "add-ring":
        if (m.rings.length >= MAX_RINGS) return;
        m.rings.push("New ring");
        save(); renderAll();
        break;

      case "add-group":
        n = m.groups.length;
        m.groups.push({ id: uid(), name: "Group " + (n + 1), color: PALETTE[n % PALETTE.length] });
        save(); renderAll();
        break;

      case "del-ring":
        if (m.rings.length <= MIN_RINGS) return;
        i = Math.round(num(b.getAttribute("data-i"), -1));
        if (i < 0 || i >= m.rings.length) return;
        m.rings.splice(i, 1);
        m.items.forEach(function (it) {
          if (it.ring === i) it.ring = Math.max(0, i - 1);
          else if (it.ring > i) it.ring -= 1;
          it.ring = Math.round(clamp(it.ring, 0, m.rings.length - 1));
        });
        save(); renderAll();
        break;

      case "del-group":
        if (m.groups.length <= 1) return;
        id = b.getAttribute("data-id");
        gone = grp(m, id);
        if (!gone) return;
        keep = m.groups.filter(function (y) { return y.id !== id; })[0];
        used = m.items.some(function (it) { return it.group === id; });
        if (used && !window.confirm('Delete the group "' + gone.name + '"? Its items move to "' + keep.name + '".')) return;
        m.groups = m.groups.filter(function (y) { return y.id !== id; });
        m.items.forEach(function (it) { if (it.group === id) it.group = keep.id; });
        save(); renderAll();
        break;

      case "del-item":
        id = b.getAttribute("data-id");
        m.items = m.items.filter(function (it) { return it.id !== id; });
        save(); renderAll();
        break;

      case "design":
        if (!THEMES[b.getAttribute("data-v")]) return;
        m.design = b.getAttribute("data-v");
        save(); renderAll();
        break;

      case "orient":
        m.orientation = b.getAttribute("data-v") === "landscape" ? "landscape" : "portrait";
        save(); renderAll();
        break;

      case "add-name":
        if (m.names.length >= MAX_NAMES) return;
        m.names.push("");
        save(); renderForm(); renderPreview();
        n = nameList.querySelector(".row.name:last-child input");
        if (n) n.focus();
        break;

      case "del-name":
        i = Math.round(num(b.getAttribute("data-i"), -1));
        if (i < 0 || i >= m.names.length) return;
        m.names.splice(i, 1);
        save(); renderAll();
        break;

      case "pick-logo":
        logoFile.click();
        break;

      case "del-logo":
        m.logo = "";
        save(); renderAll();
        break;

      case "export-csv":
        exportCSV();
        break;

      case "import-csv":
        csvFile.click();
        break;

      case "export-pdf":
        exportPDF();
        break;

      case "export-json":
        exportJSON();
        break;

      case "import-json":
        importFile.click();
        break;
    }
  }

  function addItem() {
    var m = cur();
    if (!m) return;
    var label = (newLabel.value || "").trim();
    if (!label) { newLabel.focus(); return; }
    var ring = Math.round(clamp(num(newRing.value, 0), 0, m.rings.length - 1));
    var gid = newGroup.value;
    if (!grp(m, gid)) gid = m.groups[0].id;
    m.items.push({ id: uid(), label: label.slice(0, 60), ring: ring, group: gid, angle: pickAngle(m, ring), off: 0.5 });
    newLabel.value = "";
    save(); renderAll();
    newLabel.focus();
  }

  /* ------------------------------------------------------------------
     dragging, on screen only
     ------------------------------------------------------------------ */

  var drag = null;

  function toSvg(svg, cx, cy) {
    var m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    var pt = svg.createSVGPoint();
    pt.x = cx; pt.y = cy;
    var q = pt.matrixTransform(m.inverse());
    return { x: q.x, y: q.y };
  }

  function wireDrag(svg) {
    if (!svg) return;

    svg.addEventListener("pointerdown", function (e) {
      var m = cur();
      if (!m || !e.target.closest) return;
      var node = e.target.closest("[data-id]");
      if (!node) return;
      var it = itm(m, node.getAttribute("data-id"));
      if (!it) return;
      drag = { id: it.id, node: node, base: itemPos(geom(m), m, it) };
      node.style.cursor = "grabbing";
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* older pointer support */ }
      e.preventDefault();
    });

    svg.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var m = cur();
      if (!m) return;
      var it = itm(m, drag.id);
      if (!it) return;
      var g = geom(m), b = bands(m);
      var p = toSvg(svg, e.clientX, e.clientY);
      var dx = p.x - g.cx, dy = p.y - g.cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) it.angle = ((Math.atan2(dy, dx) * 180 / Math.PI) % 360 + 360) % 360;
      var t = clamp((dist - b.r0) / (g.R - b.r0), 0, 0.999);
      it.ring = Math.floor(t * b.n);
      it.off = t * b.n - it.ring;
      var np = itemPos(g, m, it);
      drag.node.setAttribute("transform", "translate(" + r2(np.x - drag.base.x) + "," + r2(np.y - drag.base.y) + ")");
      e.preventDefault();
    });

    function end(e) {
      if (!drag) return;
      try { svg.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
      drag = null;
      save(); renderAll();
    }
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
  }

  /* ------------------------------------------------------------------
     PDF export
     ------------------------------------------------------------------ */

  function exportPDF() {
    var m = cur();
    if (!m) return;
    var ctor = window.jspdf && window.jspdf.jsPDF;
    if (!ctor) {
      window.alert("The PDF library did not load, so export is not available. Check your connection, or any script blocker, and reload the page.");
      return;
    }

    var size = SIZES[paper] ? paper : "A4";
    var d = SIZES[size];
    var land = m.orientation === "landscape";
    var pageW = land ? d[1] : d[0];
    var pageH = land ? d[0] : d[1];
    var g = geom(m);

    var host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:-99999px;top:0;width:" + g.W + "px;height:" + g.H + "px;";
    host.innerHTML = buildSVG(m, false);
    document.body.appendChild(host);

    pdfBtn.disabled = true;
    var was = pdfBtn.textContent;
    pdfBtn.textContent = "Exporting...";

    Promise.resolve().then(function () {
      var el = host.querySelector("svg");
      if (!el) throw new Error("the diagram could not be prepared");
      el.setAttribute("width", String(g.W));
      el.setAttribute("height", String(g.H));
      var doc = new ctor({
        orientation: land ? "landscape" : "portrait",
        unit: "mm",
        format: [Math.min(d[0], d[1]), Math.max(d[0], d[1])],
        compress: true
      });
      if (typeof doc.svg !== "function") {
        throw new Error("the SVG to PDF library did not load, check your connection or script blocker and reload");
      }
      return doc.svg(el, { x: 0, y: 0, width: pageW, height: pageH }).then(function () {
        doc.setProperties({ title: m.title || "Orbit model", creator: "Orbit Maker" });
        doc.save(slug(m.title) + "-" + size + ".pdf");
      });
    }).catch(function (err) {
      window.alert("The PDF could not be created: " + (err && err.message ? err.message : String(err)));
    }).then(function () {
      host.parentNode && host.parentNode.removeChild(host);
      pdfBtn.disabled = false;
      pdfBtn.textContent = was;
    });
  }

  /* ------------------------------------------------------------------
     JSON backup
     ------------------------------------------------------------------ */

  function download(text, type, name) {
    try {
      var url = URL.createObjectURL(new Blob([text], { type: type }));
      var a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.parentNode.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      return true;
    } catch (e) {
      window.alert("The file could not be created in this browser.");
      return false;
    }
  }

  function exportJSON() {
    download(JSON.stringify(state, null, 2), "application/json", "orbit-maker-backup.json");
  }

  /* ------------------------------------------------------------------
     items as a spreadsheet
     ------------------------------------------------------------------ */

  function csvCell(v) {
    var s = String(v == null ? "" : v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCSV() {
    var m = cur();
    if (!m) return;
    var rows = [["label", "ring", "group"]];
    if (m.items.length) {
      m.items.forEach(function (it) {
        var gr = grp(m, it.group);
        rows.push([it.label, m.rings[Math.round(clamp(it.ring, 0, m.rings.length - 1))], gr ? gr.name : ""]);
      });
    } else {
      /* an empty model still downloads something worth filling in */
      m.rings.forEach(function (r, i) {
        rows.push(["Example signal " + (i + 1), r, m.groups[i % m.groups.length].name]);
      });
    }
    if (download(rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n") + "\r\n",
      "text/csv;charset=utf-8", slug(m.title) + "-items.csv")) {
      note(m.items.length ? "Downloaded " + m.items.length + " items." : "Downloaded an example file to fill in.");
    }
  }

  /* Quoted fields, doubled quotes inside them, CR, LF or CRLF line ends. */
  function parseCSV(text) {
    var rows = [], row = [], cell = "", q = false, i, c;
    text = String(text).replace(/^\uFEFF/, "");
    for (i = 0; i < text.length; i++) {
      c = text.charAt(i);
      if (q) {
        if (c !== '"') { cell += c; }
        else if (text.charAt(i + 1) === '"') { cell += '"'; i++; }
        else q = false;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text.charAt(i + 1) === "\n") i++;
        row.push(cell); cell = ""; rows.push(row); row = [];
      } else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) {
      return r.some(function (v) { return String(v).trim() !== ""; });
    });
  }

  function colIndex(head, names) {
    var i, j;
    for (i = 0; i < head.length; i++) for (j = 0; j < names.length; j++) if (head[i] === names[j]) return i;
    return -1;
  }

  function note(msg) { if (csvNote) csvNote.textContent = msg; }

  function readCSV(file) {
    if (!file) return;
    var fr = new FileReader();
    fr.onerror = function () { window.alert("That file could not be read."); };
    fr.onload = function () { importCSV(String(fr.result)); };
    fr.readAsText(file);
  }

  function importCSV(text) {
    var m = cur();
    if (!m) return;
    var rows = parseCSV(text);
    if (rows.length < 2) {
      window.alert("That file has no rows under the header. The first line should read: label,ring,group");
      return;
    }
    var head = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });
    var iL = colIndex(head, ["label", "name", "item", "signal"]);
    var iR = colIndex(head, ["ring", "horizon", "level"]);
    var iG = colIndex(head, ["group", "theme", "cluster"]);
    var iA = colIndex(head, ["angle"]);
    var iO = colIndex(head, ["off", "offset"]);
    if (iL < 0) {
      window.alert("The file needs a column called label. The first line should read: label,ring,group");
      return;
    }

    var newRings = 0, newGroups = 0, added = 0;

    function ringFor(v) {
      var sv = String(v == null ? "" : v).trim(), i;
      if (!sv) return 0;
      if (/^[0-9]+$/.test(sv)) return Math.round(clamp(parseFloat(sv) - 1, 0, m.rings.length - 1));
      for (i = 0; i < m.rings.length; i++) if (m.rings[i].trim().toLowerCase() === sv.toLowerCase()) return i;
      if (m.rings.length < MAX_RINGS) { m.rings.push(sv.slice(0, 40)); newRings++; return m.rings.length - 1; }
      return m.rings.length - 1;
    }

    function groupFor(v) {
      var sv = String(v == null ? "" : v).trim(), i, ng;
      if (!sv) return m.groups[0].id;
      for (i = 0; i < m.groups.length; i++) if (m.groups[i].name.trim().toLowerCase() === sv.toLowerCase()) return m.groups[i].id;
      ng = { id: uid(), name: sv.slice(0, 40), color: PALETTE[m.groups.length % PALETTE.length] };
      m.groups.push(ng);
      newGroups++;
      return ng.id;
    }

    var body = rows.slice(1, 1 + MAX_CSV_ROWS);
    var over = rows.length - 1 - body.length;
    var replace = m.items.length
      ? window.confirm("Replace the " + m.items.length + " items already in this model?\n\n" +
        "OK replaces them. Cancel keeps them and adds the new rows.")
      : true;
    if (replace) m.items = [];

    body.forEach(function (r) {
      var label = String(r[iL] == null ? "" : r[iL]).trim();
      if (!label) return;
      var ring = iR < 0 ? 0 : ringFor(r[iR]);
      var it = {
        id: uid(), label: label.slice(0, 60), ring: ring, group: groupFor(iG < 0 ? "" : r[iG]),
        angle: 0, off: 0.5
      };
      if (iO >= 0 && String(r[iO] == null ? "" : r[iO]).trim() !== "") it.off = clamp(num(r[iO], 0.5), 0, 1);
      it.angle = (iA >= 0 && String(r[iA] == null ? "" : r[iA]).trim() !== "")
        ? ((num(r[iA], 0) % 360) + 360) % 360
        : pickAngle(m, ring);
      m.items.push(it);
      added++;
    });

    if (!added) { window.alert("No rows with a label were found in that file."); return; }
    m.items.forEach(function (it) { it.ring = Math.round(clamp(it.ring, 0, m.rings.length - 1)); });
    save();
    renderAll();
    note("Loaded " + added + " item" + (added === 1 ? "" : "s") +
      (newRings ? ", added " + newRings + " ring" + (newRings === 1 ? "" : "s") : "") +
      (newGroups ? ", added " + newGroups + " group" + (newGroups === 1 ? "" : "s") : "") +
      (over > 0 ? ". " + over + " row" + (over === 1 ? " was" : "s were") + " past the limit of " + MAX_CSV_ROWS + " and ignored" : "") + ".");
  }

  /* ------------------------------------------------------------------
     image
     ------------------------------------------------------------------ */

  function readLogo(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      window.alert("Use a PNG, JPEG or WEBP image.");
      return;
    }
    var fr = new FileReader();
    fr.onerror = function () { window.alert("That image could not be read."); };
    fr.onload = function () {
      var img = new Image();
      img.onerror = function () { window.alert("That image could not be read."); };
      img.onload = function () {
        /* Scale down before storing. A page only ever draws it about 100 units
           wide, and browser storage is small. */
        var max = 512, sc = Math.min(1, max / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * sc)), h = Math.max(1, Math.round(img.height * sc));
        var cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        try { cv.getContext("2d").drawImage(img, 0, 0, w, h); }
        catch (e) { window.alert("That image could not be read."); return; }
        var data = "";
        try { data = cv.toDataURL("image/png"); } catch (e2) { data = ""; }
        if (!data || data.length > 900000) {
          try { data = cv.toDataURL("image/jpeg", 0.82); } catch (e3) { data = ""; }
        }
        if (!data || data.length > 1600000) {
          window.alert("That image is too detailed to store. Try a smaller or simpler one.");
          return;
        }
        var m = cur();
        if (!m) return;
        var was = m.logo;
        m.logo = data;
        if (!save()) {
          m.logo = was;
          save();
          window.alert("There is not enough room left in this browser's storage for that image. Try a smaller one, or delete a model you no longer need.");
        }
        renderAll();
      };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  }

  function readImport(file) {
    if (!file) return;
    var fr = new FileReader();
    fr.onerror = function () { window.alert("That file could not be read."); };
    fr.onload = function () {
      var o = null, list, ok, added;
      try { o = JSON.parse(String(fr.result)); } catch (e) { o = null; }
      list = (o && Array.isArray(o.models)) ? o.models : (Array.isArray(o) ? o : null);
      ok = list && list.length && list.every(function (x) {
        return x && typeof x === "object" && Array.isArray(x.rings) && Array.isArray(x.groups) && Array.isArray(x.items);
      });
      if (!ok) { window.alert("That does not look like an Orbit Maker backup file."); return; }
      added = list.map(function (x) {
        var m = normalize(x);
        return m ? freshIds(m) : null;
      }).filter(Boolean);
      if (!added.length) { window.alert("That does not look like an Orbit Maker backup file."); return; }
      state.models = state.models.concat(added);
      state.current = added[0].id;
      save(); renderAll();
    };
    fr.readAsText(file);
  }

  /* ------------------------------------------------------------------
     start
     ------------------------------------------------------------------ */

  function init() {
    if (!panel || !sheet) return;
    if (!load()) {
      state.models = [sample()];
      state.current = state.models[0].id;
      save();
    }
    buildMenu();
    panel.addEventListener("click", onClick);
    document.addEventListener("click", function (e) {
      if (newMenu.hidden) return;
      if (e.target.closest && e.target.closest(".menuwrap")) return;
      setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !newMenu.hidden) { setMenu(false); newBtn.focus(); }
    });
    panel.addEventListener("input", onInput);
    panel.addEventListener("change", onChange);
    newLabel.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); addItem(); }
    });
    paperSize.value = paper;
    renderAll();
  }

  init();
}());
