const API_URL = 'https://api.github.com/users/';

// DOM Elements
const input = document.getElementById('username');
const searchContainer = document.querySelector('.search-container');
const btn = document.getElementById('generate-btn');
const themeSelect = document.getElementById('theme-select');
const typeSelect = document.getElementById('type-select');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const statsGrid = document.getElementById('stats-grid');
const downloadSvgBtn = document.getElementById('download-all-svg');
const downloadPngBtn = document.getElementById('download-png');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const shareLinkContainer = document.getElementById('share-link-container');
const shareLink = document.getElementById('share-link');
const shareUrlText = document.getElementById('share-url-text');

// Theme definitions (loaded from JSON)
// Theme definitions (loaded from JSON)
let themes = {};
let iconBase64 = ''; // Store the base64 icon

// Load custom icon
async function loadIcon() {
    try {
        const response = await fetch('icon.png');
        if (response.ok) {
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
                iconBase64 = reader.result;
            };
            reader.readAsDataURL(blob);
        }
    } catch (err) {
        console.error('Failed to load icon:', err);
    }
}

// Load themes from JSON file
async function loadThemes() {
    try {
        const response = await fetch('themes.json');
        themes = await response.json();
        populateThemeSelect();
    } catch (err) {
        console.error('Failed to load themes:', err);
        // Fallback to dark theme
        themes = {
            dark: {
                name: "Dark",
                bg1: "#0d1117",
                bg2: "#161b22",
                border: "#30363d",
                title: "#58a6ff",
                text: "#f0f6fc",
                textMuted: "#8b949e",
                textDim: "#6e7681",
                divider: "#21262d",
                font: "'Segoe UI', sans-serif"
            }
        };
    }
}

// Populate theme dropdown from loaded themes
function populateThemeSelect() {
    themeSelect.innerHTML = '';
    for (const [key, theme] of Object.entries(themes)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = theme.name || key;
        themeSelect.appendChild(option);
    }
}

// Current data storage
let currentData = null;
let currentSVG = '';

// Event Listeners
btn.addEventListener('click', generateStats);
input.addEventListener('keypress', (e) => e.key === 'Enter' && generateStats());


// Download buttons
document.getElementById('download-all-svg').addEventListener('click', downloadSVG);
document.getElementById('download-png').addEventListener('click', downloadPNG);

// Parse URL parameters and auto-load
window.addEventListener('DOMContentLoaded', async () => {
    // Load themes and icon
    await Promise.all([loadThemes(), loadIcon()]);

    const params = new URLSearchParams(window.location.search);

    // Get username from URL or use default
    const urlUsername = params.get('username') || params.get('user');
    if (urlUsername) {
        input.value = urlUsername;
        if (searchContainer) searchContainer.style.display = 'none';
        document.body.style.background = 'transparent';
        statsGrid.style.justifyContent = 'initial';
        statsGrid.style.marginTop = '0';
    }

    // Get theme from URL (default is 'dark')
    const urlTheme = params.get('theme');
    if (urlTheme && themes[urlTheme]) {
        themeSelect.value = urlTheme;
    }

    // Get type from URL (default is 'svg')
    const urlType = params.get('type');
    if (urlType && ['svg', 'png'].includes(urlType)) {
        typeSelect.value = urlType;
    }

    // Auto-generate if we have a username
    if (input.value.trim()) {
        generateStats();
    }
});

// Rerender with new theme (no API call needed)
function rerenderStats() {
    if (currentData) {
        const theme = themes[themeSelect.value]; // Get current theme
        const stats = calculateStats(currentData.userData, currentData.repos, currentData.events);
        const languages = calculateLanguages(currentData.repos, theme);
        renderUnifiedCard(currentData.userData, stats, languages);
    }
}

async function generateStats() {
    const user = input.value.trim();
    if (!user) return;

    showLoading(true);
    hideError();
    hideResults();

    try {
        const [userData, repos, events] = await Promise.all([
            fetchWithError(`${API_URL}${user}`),
            fetchWithError(`${API_URL}${user}/repos?per_page=100&sort=updated`),
            fetchWithError(`${API_URL}${user}/events/public?per_page=100`)
        ]);

        if (userData.message === 'Not Found') throw new Error('User not found');
        if (!Array.isArray(repos)) throw new Error('Could not fetch repositories');

        currentData = { userData, repos, events };

        const stats = calculateStats(userData, repos, events);
        const theme = themes[themeSelect.value]; // Get current theme
        const languages = calculateLanguages(repos, theme);

        renderProfile(userData);
        renderUnifiedCard(userData, stats, languages);

        showResults();
    } catch (err) {
        showError(err.message || 'Failed to fetch data. Please check the username.');
    } finally {
        showLoading(false);
    }
}

async function fetchWithError(url) {
    const response = await fetch(url);
    if (!response.ok && response.status !== 404) {
        throw new Error(`API Error: ${response.status}`);
    }
    return response.json();
}

function calculateStats(user, repos, events) {
    const stars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
    const forks = repos.reduce((sum, r) => sum + (r.forks_count || 0), 0);
    const commits = events.filter(e => e.type === 'PushEvent')
        .reduce((sum, e) => sum + (e.payload?.commits?.length || 0), 0);
    const prs = events.filter(e => e.type === 'PullRequestEvent').length;
    const issues = events.filter(e => e.type === 'IssuesEvent').length;
    const contributedTo = new Set(events.map(e => e.repo?.name).filter(Boolean)).size;

    // Calculate grade
    const score = stars * 2 + commits + prs * 3 + issues + contributedTo * 2 + (user.followers || 0);
    let grade, gradeColor;
    if (score >= 5000) { grade = 'S+'; gradeColor = '#58a6ff'; }
    else if (score >= 2000) { grade = 'S'; gradeColor = '#3fb950'; }
    else if (score >= 1000) { grade = 'A+'; gradeColor = '#a371f7'; }
    else if (score >= 500) { grade = 'A'; gradeColor = '#a371f7'; }
    else if (score >= 200) { grade = 'B+'; gradeColor = '#d29922'; }
    else if (score >= 100) { grade = 'B'; gradeColor = '#d29922'; }
    else if (score >= 50) { grade = 'C+'; gradeColor = '#ff9f1c'; }
    else { grade = 'C'; gradeColor = '#f85149'; }

    const gradePercent = Math.min(100, (score / 5000) * 100);

    // Calculate streak (simplified version based on recent activity)
    const recentEvents = events.filter(e => {
        const date = new Date(e.created_at);
        const now = new Date();
        const diffDays = (now - date) / (1000 * 60 * 60 * 24);
        return diffDays <= 30;
    });
    const currentStreak = Math.min(recentEvents.length, 30);
    const longestStreak = Math.max(currentStreak, 7);
    const totalContributions = commits + prs + issues;

    return { stars, forks, commits, prs, issues, contributedTo, grade, gradeColor, gradePercent, currentStreak, longestStreak, totalContributions };
}

function calculateLanguages(repos, theme) {
    const langCount = {};
    repos.forEach(repo => {
        if (repo.language) {
            langCount[repo.language] = (langCount[repo.language] || 0) + 1;
        }
    });

    const sorted = Object.entries(langCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const total = sorted.reduce((sum, [, count]) => sum + count, 0);

    return sorted.map(([lang, count], index) => ({
        name: lang,
        count,
        percent: Math.round((count / total) * 100),
        color: (theme && theme.chart && theme.chart[index % theme.chart.length])
            ? theme.chart[index % theme.chart.length]
            : getLanguageColor(lang)
    }));
}

function getLanguageColor(lang) {
    // Muted, balanced colors so no language stands out
    const colors = {
        JavaScript: '#a89f6a',
        TypeScript: '#6a8fad',
        Python: '#7a8fa5',
        Java: '#9a7a5a',
        'C++': '#a07080',
        C: '#707070',
        'C#': '#5a8a5a',
        Go: '#6a9aa5',
        Rust: '#a08a7a',
        Ruby: '#8a5a5a',
        PHP: '#6a7090',
        Swift: '#a07060',
        Kotlin: '#8a7aaa',
        Dart: '#6a9a95',
        HTML: '#a07060',
        CSS: '#7a6a8a',
        SCSS: '#9a7090',
        Vue: '#6a9a7a',
        Shell: '#7a9a6a',
        PowerShell: '#5a6a7a',
        'Jupyter Notebook': '#8a7a6a',
    };
    return colors[lang] || '#7a7a7a';
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function renderProfile(user) {
    const name = user.name || user.login;
    const bio = user.bio || 'No bio available';
    const location = user.location || 'Earth';
    const company = user.company || '';
}

function renderUnifiedCard(user, stats, languages) {
    currentSVG = createUnifiedStatsCard(user, stats, languages);
    statsGrid.innerHTML = currentSVG;
}

function createUnifiedStatsCard(user, stats, languages) {
    const name = user.name || user.login;
    const circumference = 2 * Math.PI * 55;
    const offset = circumference - (stats.gradePercent / 100) * circumference;

    // Get current theme
    const themeName = themeSelect.value;
    const theme = themes[themeName];

    // Build language bar segments
    let barSegments = '';
    let xOffset = 0;
    const barWidth = 300;
    const barHeight = 8;
    languages.forEach((lang, i) => {
        const segmentWidth = (lang.percent / 100) * barWidth;
        barSegments += `<rect x="${xOffset}" y="0" width="${segmentWidth}" height="${barHeight}" fill="${lang.color}" />`;
        xOffset += segmentWidth;
    });

    // Build language legend
    let langLegend = '';
    languages.forEach((lang, i) => {
        const xPos = (i % 3) * 105;
        const yPos = Math.floor(i / 3) * 22;
        langLegend += `
            <g transform="translate(${xPos}, ${yPos})">
                <circle cx="5" cy="5" r="5" fill="${lang.color}"/>
                <text x="14" y="9" style="font: 11px 'Segoe UI', sans-serif; fill: ${theme.textMuted};">${lang.name} ${lang.percent}%</text>
            </g>
        `;
    });

    return `
<svg width="850" height="240" viewBox="0 0 850 240" xmlns="http://www.w3.org/2000/svg" class="card-svg">
    <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${theme.bg1};stop-opacity:1" />
            <stop offset="50%" style="stop-color:${theme.bg2};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${theme.bg1};stop-opacity:1" />
        </linearGradient>
        <clipPath id="langBarClip">
            <rect x="0" y="0" width="300" height="8" rx="4"/>
        </clipPath>
    </defs>
    
    <!-- Background -->
    <rect width="850" height="240" rx="16" fill="url(#bgGrad)" stroke="${theme.border}" stroke-width="1"/>
    
    <!-- Header -->
    <text x="30" y="40" style="font: bold 22px 'Segoe UI', sans-serif; fill: ${theme.title};">${name}</text>
    <text x="30" y="60" style="font: 13px 'Segoe UI', sans-serif; fill: ${theme.textDim};">@${user.login}</text>
    
    <!-- GitHub Icon (Top Right) -->
    <path transform="translate(790, 20) scale(1.2)" fill="${theme.title}" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>

    <!-- Divider line -->
    <line x1="30" y1="75" x2="820" y2="75" stroke="${theme.line}" stroke-width="1"/>
    
    <!-- LEFT SECTION: Stats -->
    <g transform="translate(30, 85)">        
        <g transform="translate(0, 0)">
            <svg x="0" y="3" width="14" height="14" viewBox="0 0 16 16" fill="${theme.textMuted}"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>
            <text x="20" y="16" style="font: 14px 'Segoe UI', sans-serif; fill: ${theme.textMuted};">Total Stars</text>
            <text x="160" y="16" style="font: bold 14px 'Segoe UI', sans-serif; fill: ${theme.text};">${formatNumber(stats.stars)}</text>
        </g>
        <g transform="translate(0, 26)">
            <svg x="0" y="3" width="14" height="14" viewBox="0 0 16 16" fill="${theme.textMuted}"><path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"/></svg>
            <text x="20" y="16" style="font: 14px 'Segoe UI', sans-serif; fill: ${theme.textMuted};">Total Forks</text>
            <text x="160" y="16" style="font: bold 14px 'Segoe UI', sans-serif; fill: ${theme.text};">${formatNumber(stats.forks)}</text>
        </g>
        <g transform="translate(0, 52)">
            <svg x="0" y="3" width="14" height="14" viewBox="0 0 16 16" fill="${theme.textMuted}"><path d="M1.643 3.143L.427 1.927A.25.25 0 000 2.104V5.75c0 .138.112.25.25.25h3.646a.25.25 0 00.177-.427L2.715 4.215a6.5 6.5 0 11-1.18 4.458.75.75 0 10-1.493.154 8.001 8.001 0 101.6-5.684zM7.75 4a.75.75 0 01.75.75v2.992l2.028.812a.75.75 0 01-.557 1.392l-2.5-1A.75.75 0 017 8.25v-3.5A.75.75 0 017.75 4z"/></svg>
            <text x="20" y="16" style="font: 14px 'Segoe UI', sans-serif; fill: ${theme.textMuted};">Commits (recent)</text>
            <text x="160" y="16" style="font: bold 14px 'Segoe UI', sans-serif; fill: ${theme.text};">${formatNumber(stats.commits)}</text>
        </g>
        <g transform="translate(0, 78)">
            <svg x="0" y="3" width="14" height="14" viewBox="0 0 16 16" fill="${theme.textMuted}"><path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z"/></svg>
            <text x="20" y="16" style="font: 14px 'Segoe UI', sans-serif; fill: ${theme.textMuted};">Pull Requests</text>
            <text x="160" y="16" style="font: bold 14px 'Segoe UI', sans-serif; fill: ${theme.text};">${formatNumber(stats.prs)}</text>
        </g>
        <g transform="translate(0, 104)">
            <svg x="0" y="3" width="14" height="14" viewBox="0 0 16 16" fill="${theme.textMuted}"><path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"/></svg>
            <text x="20" y="16" style="font: 14px 'Segoe UI', sans-serif; fill: ${theme.textMuted};">Contributed to</text>
            <text x="160" y="16" style="font: bold 14px 'Segoe UI', sans-serif; fill: ${theme.text};">${formatNumber(stats.contributedTo)}</text>
        </g>
    </g>
    
    <!-- CENTER SECTION: Languages -->
    <g transform="translate(280, 85)">
        <text y="16" style="font: bold 13px 'Segoe UI', sans-serif; fill: ${theme.section}; text-transform: uppercase; letter-spacing: 1px;">Top Languages</text>
        
        <!-- Language bar -->
        <g transform="translate(0, 35)">
            <rect x="0" y="0" width="${barWidth}" height="8" rx="4" fill="${theme.line}"/>
            <g clip-path="url(#langBarClip)">
                ${barSegments}
            </g>
        </g>
        
        <!-- Language legend -->
        <g transform="translate(0, 60)">
            ${langLegend}
        </g>
    </g>
    
    <!-- RIGHT SECTION: Grade Circle -->
    <g transform="translate(720, 155)">
        <circle cx="0" cy="0" r="55" fill="none" stroke="${theme.line}" stroke-width="8"/>
        <circle cx="0" cy="0" r="55" fill="none" stroke="${stats.gradeColor}" stroke-width="8"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
            stroke-linecap="round" transform="rotate(-90)">
            <animate attributeName="stroke-dashoffset" 
                from="${circumference}" to="${offset}" 
                dur="1s" fill="freeze" calcMode="spline"
                keySplines="0.4 0 0.2 1"/>
        </circle>
        <text x="0" y="12" text-anchor="middle" style="font: bold 36px 'Segoe UI', sans-serif; fill: ${stats.gradeColor};">${stats.grade}</text>
        <text x="0" y="75" text-anchor="middle" style="font: 11px 'Segoe UI', sans-serif; fill: ${theme.textDim};">RANK</text>
    </g>
    
    <!-- Vertical dividers -->
    <line x1="260" y1="85" x2="260" y2="220" stroke="${theme.line}" stroke-width="1"/>
    <line x1="620" y1="85" x2="620" y2="220" stroke="${theme.line}" stroke-width="1"/>
</svg>`;
}

// Helper functions
function showLoading(show) {
    loading.classList.toggle('active', show);
}

function hideError() {
    error.classList.remove('active');
}

function showError(message) {
    error.textContent = message;
    error.classList.add('active');
}

function hideResults() {
    statsGrid.innerHTML = '';
    downloadSvgBtn.style.display = 'none';
    downloadPngBtn.style.display = 'none';
}

// Update share link URL
function updateShareLink() {
    const url = new URL(window.location.href);
    url.searchParams.set('username', input.value.trim());
    url.searchParams.set('theme', themeSelect.value);

    // Add type parameter if not default (svg)
    if (typeSelect.value !== 'svg') {
        url.searchParams.set('type', typeSelect.value);
    } else {
        url.searchParams.delete('type');
    }

    if (shareLinkContainer && shareLink && shareUrlText) {
        shareLink.href = url.toString();
        shareUrlText.textContent = url.toString();
    }
}

// Add listeners for real-time URL updates
input.addEventListener('input', updateShareLink);
themeSelect.addEventListener('change', () => {
    updateShareLink();
    rerenderStats(); // Also rerender the stats card
});
typeSelect.addEventListener('change', updateShareLink);

function showResults() {
    const params = new URLSearchParams(window.location.search);
    const apiUser = params.get('username') || params.get('user');

    if (apiUser) {
        const type = params.get('type') || 'svg'; // Default to SVG

        if (type === 'png') {
            // Render as PNG
            const svgBlob = new Blob([currentSVG], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            const img = new Image();

            img.onload = function () {
                canvas.width = 850 * 2;
                canvas.height = 240 * 2;
                ctx.scale(2, 2);
                // Use theme bg or transparent
                // For PNG, users usually expect transparency for "embeds" or matching theme
                // Let's use transparency if theme.bg1 is used in SVG, but usually we want the card's visual
                // The SVG has its own background rect. Canvas needs to be cleared.
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);

                const pngUrl = canvas.toDataURL('image/png');
                document.body.innerHTML = `<img src="${pngUrl}" style="max-width: 850px; max-height: 240px; width: 100%; height: auto; display: block;">`;
                document.body.style.margin = '0';
                document.body.style.background = 'transparent';
                document.body.style.display = 'flex';
            };
            img.src = url;
            return;
        }

        // Default: SVG
        document.body.innerHTML = currentSVG;
        document.body.style.margin = '0';
        document.body.style.background = 'transparent';
        document.body.style.display = 'flex';
        return;
    }

    downloadSvgBtn.style.display = 'inline-block';
    downloadPngBtn.style.display = 'inline-block';

    if (shareLinkContainer) {
        shareLinkContainer.style.display = 'block';
        updateShareLink(); // Update initial state
    }
}

// Download functions
function downloadSVG() {
    if (!currentSVG) return;
    const blob = new Blob([currentSVG], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${input.value.trim()}-github-stats.svg`;
    a.click();
    URL.revokeObjectURL(url);
}

function downloadPNG() {
    if (!currentSVG) return;

    const svgBlob = new Blob([currentSVG], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = function () {
        canvas.width = 850 * 2;
        canvas.height = 240 * 2;
        ctx.scale(2, 2);
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `${input.value.trim()}-github-stats.png`;
        a.click();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    };
    img.src = url;
}


