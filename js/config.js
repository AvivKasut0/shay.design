// ─────────────────────────────────────────────────────────────────────────────
//  SHAY DESIGN — Portfolio Config
//  This is the ONLY file you need to edit to manage the portfolio.
//
//  ── Adding a new client ──────────────────────────────────────────────────────
//    1. Drop the asset files into  Assets/<ClientName>/
//    2. Add  logo.png  to that folder — it's shown on the home page tile
//    3. Add a new object to the `clients` array below (copy an existing one)
//    4. Refresh the browser
//
//  ── Tile sizes ───────────────────────────────────────────────────────────────
//  Use the  size  field on each asset to control how large it appears in the
//  bento grid.  Options (desktop 6-column grid):
//
//    "normal"   →  1 col × 1 row  (default — leave out  size  for this)
//    "wide"     →  2 col × 1 row  (landscape emphasis)
//    "tall"     →  1 col × 2 rows (portrait emphasis)
//    "large"    →  2 col × 2 rows (square feature)
//    "featured" →  3 col × 2 rows (half the grid — big statement)
//    "hero"     →  6 col × 2 rows (full-width banner)
//
//  Use  tileSize  on a client to control its tile on the HOME page (same options).
//
//  ── Asset types ──────────────────────────────────────────────────────────────
//    "image"  → jpg, png, webp, gif (static)
//    "gif"    → animated GIF (plays inline)
//    "video"  → mp4, webm (autoplays silently in grid, gets controls in lightbox)
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {

  designer: {
    name:    "Shay Design",
    tagline: "Graphic & Video Design · Ads & Social Media",
    email:   "me@shay.design",          // e.g. "shay@example.com"
    social: {
      instagram: "https://lenka.co.il",      // full URL, e.g. "https://instagram.com/shaydesign"
      linkedin:  "https://lenka.co.il",      // full URL
      behance:   "https://lenka.co.il",      // full URL
    },
  },

  clients: [

    {
      id:       "animal-care",
      name:     "Animal Care",
      category: "Social Media",

      // tileSize: how large this client's tile is on the home page.
      tileSize: "featured",   // takes up half the desktop grid

      assets: [
        // Adjust "size" on any item to make it larger in the bento grid.
        // Remove the size property (or set "normal") for a standard 1×1 tile.
        { file: "Assets/Animal Care/274fe1edf4b347f8973f488bbae41451rw1200.png", type: "image" },
        { file: "Assets/Animal Care/6813a46af76a482c91cea35faa71e007rw1200.png", type: "image" },
        { file: "Assets/Animal Care/685f10e758a2489aa12b4e933d209e22rw1200.png", type: "image" },
        { file: "Assets/Animal Care/74109fd00e1046718913a7e0d4d2f326rw1200.png", type: "image" },
        { file: "Assets/Animal Care/867ba17c91fb4b75b2003a11cdfc7880rw1200.png", type: "image" },
        { file: "Assets/Animal Care/c6058b49a7ef4906be82e27e0420b424rw1200.png", type: "image" },
        { file: "Assets/Animal Care/cfb3c642249545b589453c91832e711frw1200.png", type: "image" },
        { file: "Assets/Animal Care/d7c6970e00fc4fbebb2a01fe90241f6drw1200.png", type: "image" },
        { file: "Assets/Animal Care/e42c192b4af44e41bf596a0603b95f1crw1200.png", type: "image" },
        { file: "Assets/Animal Care/f0c65ef48c0646728ae00000ecd26f51rw1200.png", type: "image" },
      ],
    },

    {
      id:       "sawt",
      name:     "Sawt",
      category: "Branding",

      tileSize: "featured",

      assets: [
        { file: "Assets/Sawt/d45fc2ee409f4d0996554d5b2537b474rw1200.gif", type: "gif" },
        { file: "Assets/Sawt/ee35099299f745afb6e0fca33be91a30rw1200.gif", type: "gif" },
        { file: "Assets/Sawt/UAe6v6pFgbposter.jpg",                       type: "image" },
        { file: "Assets/Sawt/Vy7V4D3DX4poster.jpg",                       type: "image" },
      ],
    },

    // ── Add more clients here ──────────────────────────────────────────────
    // {
    //   id:       "new-client",
    //   name:     "Client Name",
    //   category: "Ads",
    //   tileSize: "featured",   // home-page tile size (logo.png is auto-loaded)
    //   assets: [
    //     { file: "Assets/ClientName/video.mp4",  type: "video",  size: "hero" },
    //     { file: "Assets/ClientName/post1.jpg",  type: "image",  size: "large" },
    //     { file: "Assets/ClientName/post2.jpg",  type: "image" },
    //   ],
    // },

  ],

};
