# GitHub Stats Card Generator

A highly customizable, embeddable GitHub stats card generator. Create beautiful, themeable SVG or PNG cards to display your GitHub profile statistics, languages, and activity.

## 🚀 Features

-   **Dynamic Stats**: Real-time fetching of stars, forks, commits, PRs, issues, and top languages.
-   **Theme System**: Choose from built-in themes or create your own via JSON.
-   **Multiple Formats**: Export as **SVG** (vector, crisp) or **PNG** (raster).
-   **Embeddable**: Simple URL parameters allow for direct embedding in Markdown, `README.md`, or websites.
-   **Privacy Friendly**: Runs entirely client-side (mostly) or via simple static hosting.

## 🛠 Usage

### Web Interface
1.  Open `index.html` in your browser.
2.  Enter a **GitHub Username**.
3.  Select a **Theme** and **Output Type**.
4.  Click **Generate**.

### URL Parameters (Direct Access)
You can directly access/embed the card using URL parameters:

```
?username={username}&theme={theme}&type={type}
```

| Parameter  | Description | Default | Options |
| :--- | :--- | :--- | :--- |
| `username` | GitHub username to fetch stats for. | *None* | *Valid GitHub User* |
| `theme`    | Visual theme for the card. | `dark` | `dark`, `light`, `dracula`, etc. |
| `type`     | Output format behavior. | `svg` | `svg` (Raw SVG image), `png` (Image view) |

**Examples:**
-   **Standard SVG**: `?username=octocat&theme=dracula`
-   **PNG Mode**: `?username=octocat&theme=tokyonight&type=png`

---

## 🎨 Adding New Themes

The styling is driven entirely by `themes.json`. You can easily add your own color schemes without touching the code.

1.  Open `themes.json`.
2.  Add a new entry with a unique key (e.g., `"ocean_blue"`).
3.  Define the required color properties.

### Theme Structure
```json
"my_new_theme": {
    "name": "My New Theme",      // Display name in dropdown
    "bg1": "#0f172a",            // Main background color
    "bg2": "#1e293b",            // Secondary background (often same as bg1 for flat look)
    "border": "#334155",         // Card border color
    "title": "#38bdf8",          // Header text color (Username)
    "text": "#e2e8f0",           // Main stats text color
    "textMuted": "#94a3b8",      // Labels and icons color
    "textDim": "#64748b",        // User handle (@username) color
    "section": "#f472b6",        // "Top Languages" section header color
    "line": "#334155",           // Divider lines color
    "chart": [                   // Array of colors for the Top Languages chart
        "#38bdf8",
        "#818cf8",
        "#c084fc",
        "#f472b6",
        "#fb7185"
    ]
}
```

### Tips for Themes
-   **Solid Backgrounds**: Set `bg1` and `bg2` to the same color for a modern, flat look.
-   **Highlight Colors**: Use `title` and `section` for your theme's primary accent colors.
-   **Chart Palette**: Provide at least 5-6 distinct colors in the `chart` array to ensure languages in the pie chart/bar are easy to distinguish.

## 🤝 Contributing Themes

We welcome new themes! If you've created a cool color scheme, please share it:

1.  **Fork** this repository to your own GitHub account.
2.  Open `themes.json` and add your new theme object key.
3.  **Test** it by opening `index.html` locally and selecting your theme.
4.  Commit your changes and submit a **Pull Request** (PR).

We'll review it and merge it so everyone can use your theme!

## 📝 License
MIT
