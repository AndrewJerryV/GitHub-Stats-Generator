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
const cbStats = document.getElementById('cb-stats');
const cbLanguages = document.getElementById('cb-languages');
const cbGrade = document.getElementById('cb-grade');
const cbBottomSection = document.getElementById('cb-bottom-section');

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
                grade: "#58a6ff",
                line: "#30363d",
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
        const stats = calculateStats(
            currentData.userData,
            currentData.repos,
            currentData.events,
            currentData.totalCommits,
            currentData.totalPRs,
            currentData.totalIssues
        );
        const languages = calculateLanguages(currentData.repos, theme);
        renderUnifiedCard(currentData.userData, stats, languages, currentData.avatarBase64, cbStats.checked, cbLanguages.checked, cbGrade.checked, cbBottomSection.checked);
    }
}

// Fetch avatar as base64
async function fetchUserAvatar(url) {
    try {
        const response = await fetch(url);
        if (response.ok) {
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        }
    } catch (err) {
        console.warn('Failed to fetch avatar:', err);
    }
    return null;
}

// Cache logic
const CACHE_duration = 15 * 60 * 1000; // 15 minutes

function getCachedData(username) {
    try {
        const cached = localStorage.getItem(`gh_stats_${username}`);
        if (!cached) return null;
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_duration) {
            return parsed.data;
        }
    } catch (e) {
        console.error('Cache read error', e);
    }
    return null;
}

function setCachedData(username, data) {
    try {
        localStorage.setItem(`gh_stats_${username}`, JSON.stringify({
            timestamp: Date.now(),
            data: data
        }));
    } catch (e) {
        console.error('Cache write error', e);
    }
}

async function generateStats() {
    const user = input.value.trim();
    if (!user) return;

    showLoading(true);
    hideError();
    hideResults();

    // Check Cache (unless disabled via URL param)
    const params = new URLSearchParams(window.location.search);
    const useCache = params.get('cache') !== 'false';

    const cached = useCache ? getCachedData(user) : null;
    if (cached) {
        console.log('Using cached data for', user);
        currentData = cached;
        const stats = calculateStats(cached.userData, cached.repos, cached.events, cached.totalCommits, cached.totalPRs, cached.totalIssues);
        const theme = themes[themeSelect.value];
        const languages = calculateLanguages(cached.repos, theme);

        renderProfile(cached.userData);
        renderUnifiedCard(cached.userData, stats, languages, cached.avatarBase64, cbStats.checked, cbLanguages.checked, cbGrade.checked, cbBottomSection.checked);
        showResults();

        // Add "Cached" indicator if not exists
        if (!document.getElementById('cache-indicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'cache-indicator';
            indicator.textContent = '⚡ From Cache';
            indicator.style.cssText = 'position: absolute; top: 10px; right: 10px; color: #8b949e; font-size: 11px; opacity: 0.7;';
            document.body.appendChild(indicator);
        }
        showLoading(false);
        return;
    }

    // Clear indicator if fetching fresh
    const ind = document.getElementById('cache-indicator');
    if (ind) ind.remove();

    try {
        // Create promise for User Data + Avatar (chained)
        const userDataPromise = fetchWithError(`${API_URL}${user}`).then(async data => {
            if (data.message === 'Not Found') throw new Error('User not found');
            const avatar = await fetchUserAvatar(data.avatar_url);
            return { data, avatar };
        });

        // Fire all requests in parallel
        const [
            userResult,
            repos,
            totalCommits,
            events,
            totalPRs,
            totalIssues
        ] = await Promise.all([
            userDataPromise,
            fetchAllRepos(user),
            fetchTotalCommits(user),
            fetchRecentEvents(user),
            fetchSearchStats(`author:${user} type:pr`),
            fetchSearchStats(`author:${user} type:issue`)
        ]);

        const userData = userResult.data;
        const avatarBase64 = userResult.avatar;

        if (!Array.isArray(repos)) throw new Error('Could not fetch repositories');

        currentData = { userData, repos, events, totalCommits, totalPRs, totalIssues, avatarBase64 };
        setCachedData(user, currentData); // Save to cache

        const stats = calculateStats(userData, repos, events, totalCommits, totalPRs, totalIssues);
        const theme = themes[themeSelect.value];
        const languages = calculateLanguages(repos, theme);

        renderProfile(userData);
        renderUnifiedCard(userData, stats, languages, avatarBase64, cbStats.checked, cbLanguages.checked, cbGrade.checked, cbBottomSection.checked);

        showResults();
    } catch (err) {
        console.error(err);
        showError(err.message || 'Failed to fetch data. Please check the username.');
    } finally {
        showLoading(false);
    }
}

const tokenInput = document.getElementById('github-token');

function getHeaders() {
    const headers = {};
    const token = tokenInput && tokenInput.value.trim();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

async function fetchWithError(url) {
    const response = await fetch(url, { headers: getHeaders() });
    if (!response.ok && response.status !== 404) {
        throw new Error(`API Error: ${response.status}`);
    }
    return response.json();
}

async function fetchAllRepos(user) {
    // Limit to 1 page (100 repos) to save requests for unauthenticated users
    const data = await fetchWithError(`${API_URL}${user}/repos?per_page=100&sort=updated&page=1`);
    if (Array.isArray(data)) return data;
    return [];
}

// Fetches total commits using Search API (1 request vs N requests)
async function fetchTotalCommits(username) {
    try {
        const headers = {
            'Accept': 'application/vnd.github.cloak-preview+json',
            ...getHeaders()
        };

        const response = await fetch(`https://api.github.com/search/commits?q=author:${username}`, { headers });
        if (!response.ok) {
            return 0;
        }
        const data = await response.json();
        return data.total_count || 0;
    } catch (err) {
        return 0;
    }
}

async function fetchRecentEvents(user) {
    // Limit to 1 page (100 events) to save requests
    const data = await fetchWithError(`${API_URL}${user}/events/public?per_page=100&page=1`);
    if (Array.isArray(data)) return data;
    return [];
}

// Fetches total commits using Search API (1 request vs N requests)
async function fetchTotalCommits(username) {
    try {
        const response = await fetch(`https://api.github.com/search/commits?q=author:${username}`, {
            headers: {
                'Accept': 'application/vnd.github.cloak-preview+json'
            }
        });
        if (!response.ok) {
            // console.warn('Search API rate limit or error:', response.status);
            return 0;
        }
        const data = await response.json();
        return data.total_count || 0;
    } catch (err) {
        // console.error(err);
        return 0;
    }
}

async function fetchRecentEvents(user) {
    let events = [];
    let page = 1;
    // test.js fetches exactly 3 pages
    for (let p = 1; p <= 3; p++) {
        const data = await fetchWithError(`${API_URL}${user}/events/public?per_page=100&page=${p}`);
        if (!data || data.length === 0) break;
        events = events.concat(data);
    }
    return events;
}

async function fetchSearchStats(query) {
    try {
        const data = await fetchWithError(`https://api.github.com/search/issues?q=${encodeURIComponent(query)}`);
        return data.total_count || 0;
    } catch (err) {
        return 0;
    }
}

function calculateStats(user, repos, events, totalCommits, totalPRs, totalIssues) {
    const stars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
    const forks = repos.reduce((sum, r) => sum + (r.forks_count || 0), 0);

    // Calculate recent stats for Score (from events, matching test.js)
    let issueCountRecent = 0;
    let prCountRecent = 0;
    const contributedRepos = new Set();

    // Streak Calculation
    const contributionDates = new Set();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Format YYYY-MM-DD
    const formatDate = (d) => d.toISOString().split('T')[0];
    const todayStr = formatDate(today);
    const yesterdayStr = formatDate(yesterday);

    events.forEach(e => {
        if (e.type === "PushEvent" || e.type === "PullRequestEvent" || e.type === "IssuesEvent" || e.type === "PullRequestReviewEvent") {
            const dateStr = formatDate(new Date(e.created_at));
            contributionDates.add(dateStr);

            if (e.type === "PushEvent") contributedRepos.add(e.repo.name);
            if (e.type === "PullRequestEvent") { prCountRecent++; contributedRepos.add(e.repo.name); }
            if (e.type === "IssuesEvent") { issueCountRecent++; contributedRepos.add(e.repo.name); }
            if (e.type === "PullRequestReviewEvent") contributedRepos.add(e.repo.name);
        }
    });

    // Calc Streak
    let currentStreak = 0;
    let streakEndDate = new Date();
    let streakStartDate = new Date();

    // Check if streak is active (today or yesterday)
    let checkDate = new Date();
    let isToday = contributionDates.has(formatDate(checkDate));

    if (!isToday) {
        checkDate.setDate(checkDate.getDate() - 1); // Check yesterday
        if (!contributionDates.has(formatDate(checkDate))) {
            currentStreak = 0; // inactive
        } else {
            currentStreak = 1; // active from yesterday
            streakEndDate = new Date(checkDate); // End date is yesterday
            checkDate.setDate(checkDate.getDate() - 1);
        }
    } else {
        currentStreak = 1; // active today
        streakEndDate = new Date(); // End date is today
        checkDate.setDate(checkDate.getDate() - 1);
    }

    // Count backwards
    while (currentStreak > 0) {
        if (contributionDates.has(formatDate(checkDate))) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    // Calculate start date (EndDate - (Streak - 1) days)
    if (currentStreak > 0) {
        const start = new Date(streakEndDate);
        start.setDate(start.getDate() - (currentStreak - 1));
        streakStartDate = start;
    }

    const formatDateShort = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const streakRange = currentStreak > 0 ? `${formatDateShort(streakStartDate)} - ${formatDateShort(streakEndDate)}` : '';

    const formatDateMedium = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const joinedDate = user.created_at ? new Date(user.created_at) : new Date();
    const totalContributionRange = `${formatDateMedium(joinedDate)} - Present`;

    const contributedTo = contributedRepos.size;
    const totalContributions = totalCommits + totalPRs + totalIssues; // Best effort total

    // ... existing score calculation ...

    // Score formula from test.js:
    // stars * 2 + commits + prs * 3 + issues + contributedTo * 2 + followers
    const score =
        stars * 2 +
        totalCommits +
        prCountRecent * 3 +
        issueCountRecent +
        contributedTo * 2 +
        (user.followers || 0);

    let grade;
    if (score >= 5000) grade = 'S+';
    else if (score >= 2000) grade = 'S';
    else if (score >= 1000) grade = 'A+';
    else if (score >= 500) grade = 'A';
    else if (score >= 200) grade = 'B+';
    else if (score >= 100) grade = 'B';
    else if (score >= 50) grade = 'C+';
    else grade = 'C';

    const gradeMap = {
        'S+': 100, 'S': 90,
        'A+': 80, 'A': 70,
        'B+': 60, 'B': 50,
        'C+': 40, 'C': 30
    };
    const gradePercent = gradeMap[grade] || 30;

    return {
        stars,
        forks,
        commits: totalCommits,
        prs: totalPRs,
        issues: totalIssues,
        contributedTo,
        totalContributions,
        totalContributionRange,
        currentStreak,
        streakRange,
        grade,
        gradePercent,
        score
    };
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

function renderUnifiedCard(user, stats, languages, avatarBase64, showStats = true, showLanguages = true, showGrade = true, showBottomSection = true) {
    currentSVG = createUnifiedStatsCard(user, stats, languages, avatarBase64, showStats, showLanguages, showGrade, showBottomSection);
    statsGrid.innerHTML = currentSVG;
}

function createUnifiedStatsCard(user, stats, languages, avatarBase64, showStats, showLanguages, showGrade, showBottomSection) {
    const name = user.name || user.login;
    const circumference = 2 * Math.PI * 55;
    const offset = circumference - (stats.gradePercent / 100) * circumference;

    // Get current theme
    const themeName = themeSelect.value;
    const theme = themes[themeName];

    // Module Config
    // Stats: ~250px
    // Languages: ~350px (bar width 300 + padding)
    // Grade: ~200px
    const gap = 40;
    const modules = [
        {
            id: 'stats',
            visible: showStats,
            width: 240,
            render: (x) => `
    <g transform="translate(${x}, 85)">        
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
            <text x="20" y="16" style="font: 14px 'Segoe UI', sans-serif; fill: ${theme.textMuted};">Total Commits</text>
            <text x="160" y="16" style="font: bold 14px 'Segoe UI', sans-serif; fill: ${theme.text};">${formatNumber(stats.commits)}</text>
        </g>
        <g transform="translate(0, 78)">
            <svg x="0" y="3" width="14" height="14" viewBox="0 0 16 16" fill="${theme.textMuted}"><path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000 1.5z"/></svg>
            <text x="20" y="16" style="font: 14px 'Segoe UI', sans-serif; fill: ${theme.textMuted};">Pull Requests</text>
            <text x="160" y="16" style="font: bold 14px 'Segoe UI', sans-serif; fill: ${theme.text};">${formatNumber(stats.prs)}</text>
        </g>
        <g transform="translate(0, 104)">
            <svg x="0" y="3" width="14" height="14" viewBox="0 0 16 16" fill="${theme.textMuted}"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9 3a1 1 0 11-2 0 1 1 0 012 0zm-.25-6.25a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z"/></svg>
            <text x="20" y="16" style="font: 14px 'Segoe UI', sans-serif; fill: ${theme.textMuted};">Total Issues</text>
            <text x="160" y="16" style="font: bold 14px 'Segoe UI', sans-serif; fill: ${theme.text};">${formatNumber(stats.issues)}</text>
        </g>
        <g transform="translate(0, 130)">
            <svg x="0" y="3" width="14" height="14" viewBox="0 0 16 16" fill="${theme.textMuted}"><path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"/></svg>
            <text x="20" y="16" style="font: 14px 'Segoe UI', sans-serif; fill: ${theme.textMuted};">Contributed to</text>
            <text x="160" y="16" style="font: bold 14px 'Segoe UI', sans-serif; fill: ${theme.text};">${formatNumber(stats.contributedTo)}</text>
        </g>
    </g>`
        },
        {
            id: 'languages',
            visible: showLanguages,
            width: 380,
            render: (x) => {
                // Build language bar segments
                let barSegments = '';
                let xOffset = 0;
                const barWidth = 300;
                const barHeight = 12; // Increased height

                languages.forEach((lang, i) => {
                    const segmentWidth = (lang.percent / 100) * barWidth;
                    barSegments += `<rect x="${xOffset}" y="0" width="${segmentWidth}" height="${barHeight}" fill="${lang.color}" />`;
                    xOffset += segmentWidth;
                });

                // Re-build standard segments for better compatibility if needed, but the animate approach is cool.
                // Let's use the robust approach: width is set, animate 'width' from 0.
                barSegments = '';
                xOffset = 0;
                languages.forEach((lang, i) => {
                    const segmentWidth = (lang.percent / 100) * barWidth;
                    barSegments += `<rect x="${xOffset}" y="0" width="${segmentWidth}" height="${barHeight}" fill="${lang.color}">
                        <animate attributeName="width" from="0" to="${segmentWidth}" dur="1s" begin="0s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1"/>
                   </rect>`;
                    xOffset += segmentWidth;
                });

                // Build language legend (Chips style)
                let langLegend = '';
                // 3 columns
                languages.forEach((lang, i) => {
                    const col = i % 2; // 2 columns for wider chips
                    const row = Math.floor(i / 2);
                    const xPos = col * 190; // Increased from 150 to prevent overlap
                    const yPos = row * 25;

                    langLegend += `
            <g transform="translate(${xPos}, ${yPos})">
                <rect x="0" y="0" width="10" height="10" rx="2" fill="${lang.color}"/>
                <text x="18" y="9" style="font: 12px 'Segoe UI', sans-serif; fill: ${theme.text}; font-weight: 600;">${lang.name} <tspan fill="${theme.textMuted}" style="font-weight: 400;">${lang.percent}%</tspan></text>
            </g>
        `;
                });

                return `
    <g transform="translate(${x}, 85)">
        <text y="16" style="font: bold 13px 'Segoe UI', sans-serif; fill: ${theme.section}; text-transform: uppercase; letter-spacing: 1px;">Top Languages</text>
        
        <!-- Language bar -->
        <g transform="translate(0, 35)">
            <rect x="0" y="0" width="${barWidth}" height="${barHeight}" rx="6" fill="${theme.line}"/> <!-- Rounded background -->
            <g clip-path="url(#langBarClip)">
                ${barSegments}
            </g>
        </g>
        
        <!-- Language legend -->
        <g transform="translate(0, 65)">
            ${langLegend}
        </g>
    </g>`;
            }
        },
        {
            id: 'grade',
            visible: showGrade,
            width: 140,
            render: (x) => `
    <g transform="translate(${x + 70}, 155)"> <!-- Center in 140px space -->
        <circle cx="0" cy="0" r="55" fill="none" stroke="${theme.line}" stroke-width="8"/>
        <circle cx="0" cy="0" r="55" fill="none" stroke="${theme.grade || stats.gradeColor || theme.title}" stroke-width="8"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
            stroke-linecap="round" transform="rotate(-90)">
            <animate attributeName="stroke-dashoffset" 
                from="${circumference}" to="${offset}" 
                dur="1s" fill="freeze" calcMode="spline"
                keySplines="0.4 0 0.2 1"/>
        </circle>
        <text x="0" y="12" text-anchor="middle" style="font: bold 36px 'Segoe UI', sans-serif; fill: ${theme.grade || stats.gradeColor || theme.title};">${stats.grade}</text>
        <text x="0" y="75" text-anchor="middle" style="font: 11px 'Segoe UI', sans-serif; fill: ${theme.textDim};">GRADE</text>
    </g>`
        }
    ];

    const activeModules = modules.filter(m => m.visible);
    const padding = 30;

    // Calculate total width explicitly from modules + gaps
    const totalGaps = Math.max(0, activeModules.length - 1) * gap;
    const totalContentWidth = activeModules.reduce((sum, m) => sum + m.width, 0);
    const totalWidth = padding * 2 + totalContentWidth + totalGaps;

    let contentSVG = '';
    let currentX = padding;

    activeModules.forEach((mod, index) => {
        // Render module
        contentSVG += mod.render(currentX);

        // Render divider if not last
        if (index < activeModules.length - 1) {
            const dividerX = currentX + mod.width + (gap / 2);
            contentSVG += `<line x1="${dividerX}" y1="85" x2="${dividerX}" y2="250" stroke="${theme.line}" stroke-width="1"/>`;

            // Advance cursor past module and gap
            currentX += mod.width + gap;
        } else {
            currentX += mod.width;
        }
    });

    // Min width enforcement (for header text)
    const finalWidth = Math.max(totalWidth, 400);
    const bottomSectionY = 260;
    const newHeight = showBottomSection ? 420 : 270;

    const bottomSectionContent = showBottomSection ? `
    <!-- Bottom Section Divider -->
    <line x1="30" y1="${bottomSectionY}" x2="${finalWidth - 30}" y2="${bottomSectionY}" stroke="${theme.line}" stroke-width="1"/>

    <!-- Bottom Section Content -->
    <g transform="translate(0, ${bottomSectionY})">
        
        <!-- Total Contributions (Left) -->
        <g transform="translate(${finalWidth * 0.15}, 65)">
             <text text-anchor="middle" style="font: bold 26px 'Segoe UI', sans-serif; fill: ${theme.text};">${formatNumber(stats.totalContributions || 0)}</text>
             <text y="28" text-anchor="middle" style="font: 14px 'Segoe UI', sans-serif; fill: ${theme.textMuted};">Total Contributions</text>
             <text y="50" text-anchor="middle" style="font: 12px 'Segoe UI', sans-serif; fill: ${theme.textMuted};">${stats.totalContributionRange || ''}</text>
        </g>

        <!-- Streak (Center) -->
        <g transform="translate(${finalWidth * 0.5}, 65)">
             <!-- Streak Circle with Gap -->
             <!-- Gap for icon at top (approx 35px) -->
             <circle cx="0" cy="0" r="45" fill="none" stroke="#ff8c00" stroke-width="5"
                 stroke-dasharray="${2 * Math.PI * 45 - 40} 40" 
                 stroke-dashoffset="${-(40 / 2)}"
                 transform="rotate(-90)"
                 stroke-linecap="round" />
             
             <!-- Fire Icon (Top Center) -->
             <g transform="translate(-15, -61)">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.8324 21.8013C15.9583 21.1747 20 18.926 20 13.1112C20 7.8196 16.1267 4.29593 13.3415 2.67685C12.7235 2.31757 12 2.79006 12 3.50492V5.3334C12 6.77526 11.3938 9.40711 9.70932 10.5018C8.84932 11.0607 7.92052 10.2242 7.816 9.20388L7.73017 8.36604C7.6304 7.39203 6.63841 6.80075 5.85996 7.3946C4.46147 8.46144 3 10.3296 3 13.1112C3 20.2223 8.28889 22.0001 10.9333 22.0001C11.0871 22.0001 11.2488 21.9955 11.4171 21.9858C10.1113 21.8742 8 21.064 8 18.4442C8 16.3949 9.49507 15.0085 10.631 14.3346C10.9365 14.1533 11.2941 14.3887 11.2941 14.7439V15.3331C11.2941 15.784 11.4685 16.4889 11.8836 16.9714C12.3534 17.5174 13.0429 16.9454 13.0985 16.2273C13.1161 16.0008 13.3439 15.8564 13.5401 15.9711C14.1814 16.3459 15 17.1465 15 18.4442C15 20.4922 13.871 21.4343 12.8324 21.8013Z" fill="#FB8C00"/>
                </svg>
             </g>
             
             <!-- Count -->
             <text y="15" text-anchor="middle" style="font: bold 32px 'Segoe UI', sans-serif; fill: ${theme.text};">${stats.currentStreak || 0}</text>
             
             <!-- Label -->
             <text y="70" text-anchor="middle" style="font: bold 16px 'Segoe UI', sans-serif; fill: #ff8c00;">Current Streak</text>
             
             <!-- Date Range -->
             <text y="90" text-anchor="middle" style="font: 12px 'Segoe UI', sans-serif; fill: ${theme.textMuted};">${stats.streakRange || ''}</text>
        </g>

        <!-- Followers & Following (Right) -->
        <g transform="translate(${finalWidth * 0.85}, 40)">
             <!-- Followers -->
             <text text-anchor="middle" style="font: bold 20px 'Segoe UI', sans-serif; fill: ${theme.text};">${formatNumber(user.followers || 0)}</text>
             <text y="20" text-anchor="middle" style="font: 13px 'Segoe UI', sans-serif; fill: ${theme.textMuted};">Followers</text>
             
             <!-- Following -->
             <text y="60" text-anchor="middle" style="font: bold 20px 'Segoe UI', sans-serif; fill: ${theme.text};">${formatNumber(user.following || 0)}</text>
             <text y="80" text-anchor="middle" style="font: 13px 'Segoe UI', sans-serif; fill: ${theme.textMuted};">Following</text>
        </g>
    </g>` : '';

    return `
<svg width="${finalWidth}" height="${newHeight}" viewBox="0 0 ${finalWidth} ${newHeight}" xmlns="http://www.w3.org/2000/svg" class="card-svg">
    <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${theme.bg1};stop-opacity:1" />
            <stop offset="50%" style="stop-color:${theme.bg2};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${theme.bg1};stop-opacity:1" />
        </linearGradient>
        <clipPath id="langBarClip">
            <rect x="0" y="0" width="300" height="12" rx="6"/>
        </clipPath>
        ${avatarBase64 ? `<clipPath id="avatarClip"><circle cx="${finalWidth - 50}" cy="40" r="20" /></clipPath>` : ''}
    </defs>
    
    <!-- Background -->
    <rect width="${finalWidth}" height="${newHeight}" rx="16" fill="url(#bgGrad)" stroke="${theme.border}" stroke-width="1"/>
    
    <!-- Header -->
    <text x="30" y="40" style="font: bold 22px 'Segoe UI', sans-serif; fill: ${theme.title};">${name}</text>
    <text x="30" y="60" style="font: 13px 'Segoe UI', sans-serif; fill: ${theme.textDim};">@${user.login}</text>
    
    <!-- Avatar (Top Right) -->
    ${avatarBase64 ? `<image href="${avatarBase64}" x="${finalWidth - 70}" y="20" width="40" height="40" clip-path="url(#avatarClip)" />` : ''}

    <!-- Divider line -->
    <line x1="30" y1="75" x2="${finalWidth - 30}" y2="75" stroke="${theme.line}" stroke-width="1"/>
    
    ${contentSVG}

    ${bottomSectionContent}
</svg>`;
}

// Helper functions (same as before)
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

function updateShareLink() {
    const url = new URL(window.location.href);
    url.searchParams.set('username', input.value.trim());
    url.searchParams.set('theme', themeSelect.value);
    if (typeSelect.value !== 'svg') {
        url.searchParams.set('type', typeSelect.value);
    } else {
        url.searchParams.delete('type');
    }
    url.searchParams.set('cache', 'false');
    if (shareLinkContainer && shareLink && shareUrlText) {
        shareLink.href = url.toString();
        shareUrlText.textContent = url.toString();
    }
}

input.addEventListener('input', updateShareLink);
themeSelect.addEventListener('change', () => { updateShareLink(); rerenderStats(); });
typeSelect.addEventListener('change', updateShareLink);
[cbStats, cbLanguages, cbGrade, cbBottomSection].forEach(cb => {
    cb.addEventListener('change', () => { updateShareLink(); rerenderStats(); });
});

function cleanSvgForPng(svg) {
    return svg.replace(/<animate[^>]*>/g, '');
}

function showResults() {
    const params = new URLSearchParams(window.location.search);
    const apiUser = params.get('username') || params.get('user');

    if (apiUser) {
        const type = params.get('type') || 'svg';
        if (type === 'png') {
            const staticSvg = cleanSvgForPng(currentSVG);
            const svgBlob = new Blob([staticSvg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            const img = new Image();
            img.onload = function () {
                canvas.width = img.width * 2;
                canvas.height = img.height * 2;
                ctx.scale(2, 2);
                const themeName = themeSelect.value;
                const theme = themes[themeName];
                ctx.fillStyle = theme ? theme.bg1 : '#0d1117';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
                const pngUrl = canvas.toDataURL('image/png');
                document.body.innerHTML = `<img src="${pngUrl}" style="max-width: ${img.width}px; max-height: ${img.height}px; width: 100%; height: auto; display: block;">`;
                document.body.style.margin = '0';
                document.body.style.background = 'transparent';
                document.body.style.display = 'flex';
            };
            img.src = url;
            return;
        }
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
        updateShareLink();
    }
}

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
    const staticSvg = cleanSvgForPng(currentSVG);
    const svgBlob = new Blob([staticSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = function () {
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        ctx.scale(2, 2);
        const themeName = themeSelect.value;
        const theme = themes[themeName];
        ctx.fillStyle = theme ? theme.bg1 : '#0d1117';
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
