const HEADERS = {
  "Accept": "application/vnd.github+json"
};

async function fetchJSON(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function getGitHubStats90Days(username) {
  /* -------------------------------
     Total Stars & Forks
  --------------------------------*/
  let page = 1;
  let totalStars = 0;
  let totalForks = 0;
  const reposData = [];

  while (true) {
    const repos = await fetchJSON(
      `https://api.github.com/users/${username}/repos?per_page=100&page=${page}`
    );
    if (repos.length === 0) break;

    for (const r of repos) {
      totalStars += r.stargazers_count;
      totalForks += r.forks_count;
      reposData.push(r);
    }
    page++;
  }

  /* -------------------------------
     Total Commits (iterate all repos)
  --------------------------------*/
  let totalCommits = 0;
  console.log(`Fetching commits for ${reposData.length} repositories...`);

  // Fetch commits for each repo
  for (const repo of reposData) {
    // Optional: skip forks if desired, but "commits by author" usually implies all work.
    // if (repo.fork) continue; 

    try {
      const commitsURL = `https://api.github.com/repos/${username}/${repo.name}/commits?author=${username}&per_page=100`;
      const commits = await fetchJSON(commitsURL);
      // Note: This fetches top 100 per repo. 
      totalCommits += commits.length;
    } catch (err) {
      // console.warn(`  Failed to fetch commits for ${repo.name}: ${err.message}`);
    }
  }

  /* -------------------------------
     Events (last ~90 days) - for "Contributed to" and recent activity stats
  --------------------------------*/
  let issueCountRecent = 0;
  let prCountRecent = 0;
  const contributedRepos = new Set();

  const eventsData = [];



  console.log(`Fetching events (for contribution stats)...`);

  for (let p = 1; p <= 3; p++) {
    const events = await fetchJSON(
      `https://api.github.com/users/${username}/events/public?per_page=100&page=${p}`
    );

    eventsData.push(...events);

    for (const e of events) {
      if (e.type === "PushEvent") {
        // commitCount referenced here previously, now separate.
        contributedRepos.add(e.repo.name);
      } else if (e.type === "PullRequestEvent") {
        prCountRecent++;
        contributedRepos.add(e.repo.name);
      } else if (e.type === "IssuesEvent") {
        issueCountRecent++;
        contributedRepos.add(e.repo.name);
      } else if (e.type === "PullRequestReviewEvent") {
        contributedRepos.add(e.repo.name);
      }
    }
  }

  /* -------------------------------
     Total PRs (all time)
  --------------------------------*/
  const prs = await fetchJSON(
    `https://api.github.com/search/issues?q=author:${username}+type:pr`
  );

  /* -------------------------------
     Total Issues (all time)
  --------------------------------*/
  const issues = await fetchJSON(
    `https://api.github.com/search/issues?q=author:${username}+type:issue`
  );

  /* -------------------------------
      User Info (for followers)
   --------------------------------*/
  const user = await fetchJSON(`https://api.github.com/users/${username}`);

  /* -------------------------------
     Calculate Grade
  --------------------------------*/
  // Score formula from script.js:
  // stars * 2 + commits + prs * 3 + issues + contributedTo * 2 + followers

  const score =
    totalStars * 2 +
    totalCommits +
    prCountRecent * 3 +
    issueCountRecent +
    contributedRepos.size * 2 +
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

  /* -------------------------------
     Top Languages
  --------------------------------*/
  const langCount = {};
  reposData.forEach(repo => {
    if (repo.language) {
      langCount[repo.language] = (langCount[repo.language] || 0) + 1;
    }
  });

  const sortedLanguages = Object.entries(langCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang, count]) => ({ lang, count }));

  return {
    "Total Stars Earned": totalStars,
    "Total Forks": totalForks,
    "Total Commits": totalCommits,
    "Total PRs": prs.total_count,
    "Total Issues": issues.total_count,
    "Contributed to (last 3 months)": contributedRepos.size,
    "Grade": grade,
    "Score": score,
    "Top Languages": sortedLanguages
  };
}

/* -------------------------------
   Usage
--------------------------------*/
getGitHubStats90Days("AndrewJerryV")
  .then(stats => console.log(stats))
  .catch(console.error);
