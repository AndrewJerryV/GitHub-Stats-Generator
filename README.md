# GitHub Stats Card Generator

A highly customizable, embeddable GitHub stats card generator. Create beautiful, themeable SVG or PNG cards to display your GitHub profile statistics, languages, and activity.

## 🚀 Features

-   **Dynamic Stats**: Real-time fetching of stars, forks, commits, PRs, issues, and top languages.
-   **Toggle Modules**: Show or hide specific sections (Stats, Languages, Grade, Activity) to customize your card.
-   **Theme System**: Choose from built-in themes or create your own with support for background gradients.
-   **Sticky Settings**: Remembers your last used username, theme, and configuration via `localStorage`.
-   **Multiple Formats**: Export as **SVG** (vector, crisp) or **PNG** (raster).
-   **Embeddable**: Simple URL parameters allow for direct embedding in Markdown, `README.md`, or websites.
-   **State Sync**: Checkbox states are automatically synchronized with URL parameters for easy sharing.

## 🛠 Usage

### Web Interface
1.  Open `index.html` in your browser.
2.  Enter a **GitHub Username**.
3.  Customize your card by toggling sections in the **options** area.
4.  Select a **Theme** and **Output Type**.
5.  Click **Generate**.

### URL Parameters (Direct Access)
You can directly access/embed the card using URL parameters:

```
?username={username}&theme={theme}&type={type}&stats={bool}&languages={bool}&grade={bool}&activity={bool}
```

| Parameter   | Description                              | Default | Options                 |
| :---------- | :--------------------------------------- | :------ | :---------------------- |
| `username`  | GitHub username to fetch stats for.      | *None*  | *Valid GitHub User*     |
| `theme`     | Visual theme for the card.               | `dark`  | `dark`, `tokyonight`, etc. |
| `type`      | Output format behavior.                  | `svg`   | `svg`, `png`            |
| `stats`     | Show/Hide the main statistics module.     | `true`  | `true`, `false`         |
| `languages` | Show/Hide the top languages module.      | `true`  | `true`, `false`         |
| `grade`     | Show/Hide the overall grade module.      | `true`  | `true`, `false`         |
| `activity`  | Show/Hide the bottom activity section.   | `true`  | `true`, `false`         |

**Examples:**
-   **Customized Layout**: `?username=octocat&grade=false&activity=false`
-   **Synthwave Theme**: `?username=octocat&theme=synthwave&type=png`

---

## 🎨 Adding New Themes

The styling is driven entirely by `themes.json`. You can easily add your own color schemes without touching the code.

1.  Open `themes.json`.
2.  Add a new entry with a unique key.
3.  Define the required color properties.

### Theme Structure
```json
"my_new_theme": {
    "name": "My New Theme",      // Display name in dropdown
    "bg1": "#0d1117",            // Background gradient start
    "bg2": "#161b22",            // Background gradient end
    "border": "#30363d",         // Card border color
    "title": "#58a6ff",          // Header text color (Username)
    "text": "#f0f6fc",           // Main stats text color
    "textMuted": "#8b949e",      // Labels and icons color
    "textDim": "#6e7681",        // User handle (@username) color
    "section": "#58a6ff",        // "Top Languages" section header color
    "line": "#30363d",           // Divider lines color
    "chart": [                   // Array of colors for the Top Languages chart
        "#58a6ff",
        "#3fb950",
        "#d29922",
        "#a371f7",
        "#8b949e"
    ]
}
```

### Tips for Themes
-   **Gradients**: Set `bg1` and `bg2` to different values to create a subtle depth effect. For a flat look, set them to the same value.
-   **Legibility**: Ensure your `text` and `title` colors have high contrast against the `bg1`/`bg2` colors.
-   **Chart Palette**: Provide at least 5 distinct colors in the `chart` array for the language bar segments.

## 🤝 Contributing Themes

We welcome new themes! If you've created a cool color scheme, please share it:

1.  **Fork** this repository.
2.  Add your theme to `themes.json`.
3.  **Test** it locally.
4.  Submit a **Pull Request**.

## 📊 JSON Data Access (API Mode)
You can get the raw stats data in JSON format by setting `type=json`. This mimics a REST API response, returning a clean, minified JSON object with appropriate headers (via `<pre>` tag scraping).

```
?username=octocat&type=json
```

### Parsing the Data
If you are consuming this via a script or scraper, the JSON is embedded in a `<pre id="json-data">` tag to prevent HTML rendering issues. You can extract it easily using JavaScript:

```javascript
const data = JSON.parse(document.getElementById('json-data').textContent);
console.log(data);
```

**JSON Structure:**
```json
{
  "user": { ... },
  "stats": { ... },
  "languages": [ ... ],
  "contributions": [ ... ]
}
```

## 📝 License
MIT
