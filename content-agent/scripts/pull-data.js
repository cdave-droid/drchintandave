// pull-data.js — pulls REAL Instagram data via Apify's instagram-scraper.
//
// Why this actor (and not instagram-profile-scraper):
//   The profile scraper's `latestPosts` field returns only RECENT posts, so it
//   gets your all-time top post wrong. We use apify/instagram-scraper with
//   resultsType: "posts" + a high resultsLimit to pull your FULL history, then
//   rank every post by views. We use resultsType: "details" only to read the
//   follower count — never to decide the top post.
//
// Run:  npm run pull   (from content-agent/)

import 'dotenv/config';
import { ApifyClient } from 'apify-client';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- CONFIG (mirror of the handles in CLAUDE.md) --------------------------
const ME = 'drchintandave';
const COMPETITORS = ['zentensivist', 'doctormike'];
const ME_POST_LIMIT = 500; // "high" — pulls full history (stops early if fewer)
const COMPETITOR_POST_LIMIT = 60; // recent posts per competitor
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'dashboard', 'data.json');
const ACTOR = 'apify/instagram-scraper';

const token = process.env.APIFY_TOKEN;
if (!token) {
  console.error('❌ APIFY_TOKEN missing. Add it to content-agent/.env');
  process.exit(1);
}
const client = new ApifyClient({ token });

const url = (u) => `https://www.instagram.com/${u}/`;
const viewsOf = (p) => p.videoViewCount || p.videoPlayCount || 0;
const num = (n) => (typeof n === 'number' ? n : 0);

async function runActor(input, label) {
  console.log(`   → Apify: ${label} ...`);
  const run = await client.actor(ACTOR).call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log(`     got ${items.length} item(s)`);
  return items;
}

// Pull profile details (follower count etc.) for a set of usernames.
async function pullDetails(usernames) {
  const items = await runActor(
    { directUrls: usernames.map(url), resultsType: 'details', resultsLimit: 1 },
    `profile details for ${usernames.length} account(s)`
  );
  const byUser = {};
  for (const it of items) {
    const uname = (it.username || '').toLowerCase();
    if (uname) byUser[uname] = it;
  }
  return byUser;
}

// Pull posts for one username and shape/rank them.
async function pullPosts(username, limit) {
  const items = await runActor(
    { directUrls: [url(username)], resultsType: 'posts', resultsLimit: limit, addParentData: false },
    `posts for @${username} (limit ${limit})`
  );
  const posts = items
    .filter((p) => p.shortCode || p.id)
    .map((p) => ({
      id: p.id || p.shortCode,
      shortCode: p.shortCode || null,
      url: p.url || (p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : null),
      type: p.type || (p.videoViewCount != null ? 'Video' : 'Image'),
      caption: (p.caption || '').slice(0, 300),
      views: viewsOf(p),
      likes: num(p.likesCount),
      comments: num(p.commentsCount),
      timestamp: p.timestamp || null,
      thumbnail: p.displayUrl || null,
    }))
    .sort((a, b) => b.views - a.views || b.likes - a.likes);
  return posts;
}

function summarize(username, details, posts) {
  const totalViews = posts.reduce((s, p) => s + p.views, 0);
  const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
  const totalComments = posts.reduce((s, p) => s + p.comments, 0);
  const followers = num(details?.followersCount);
  // Engagement = (likes+comments) per post / followers, as a %.
  const perPost = posts.length ? (totalLikes + totalComments) / posts.length : 0;
  const engagement = followers ? +((perPost / followers) * 100).toFixed(2) : 0;
  return {
    username,
    fullName: details?.fullName || username,
    followers,
    following: num(details?.followsCount),
    postsCount: num(details?.postsCount) || posts.length,
    profilePicUrl: details?.profilePicUrl || null,
    verified: !!details?.verified,
    postsPulled: posts.length,
    totalViews,
    totalLikes,
    totalComments,
    engagement,
    topPosts: posts.slice(0, 10),
    posts,
  };
}

async function main() {
  console.log(`\n📡 Pulling real Instagram data via Apify\n   me: @${ME}\n   competitors: ${COMPETITORS.map((c) => '@' + c).join(', ')}\n`);

  const details = await pullDetails([ME, ...COMPETITORS]);

  console.log('\n📥 My posts (full history)…');
  const myPosts = await pullPosts(ME, ME_POST_LIMIT);
  const me = summarize(ME, details[ME.toLowerCase()], myPosts);

  const competitors = [];
  for (const c of COMPETITORS) {
    console.log(`\n📥 Competitor @${c}…`);
    const posts = await pullPosts(c, COMPETITOR_POST_LIMIT);
    competitors.push(summarize(c, details[c.toLowerCase()], posts));
  }

  const data = { generatedAt: new Date().toISOString(), me, competitors };
  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(data, null, 2));

  // ---- Human-readable summary ----
  console.log('\n' + '='.repeat(56));
  console.log(`✅ SAVED → dashboard/data.json`);
  console.log('='.repeat(56));
  console.log(`\n👤 @${me.username} — ${me.fullName}${me.verified ? ' ✓' : ''}`);
  console.log(`   Followers: ${me.followers.toLocaleString()}`);
  console.log(`   Posts pulled: ${me.postsPulled} (account total ~${me.postsCount})`);
  console.log(`   Total views across pulled posts: ${me.totalViews.toLocaleString()}`);
  console.log(`   Avg engagement: ${me.engagement}%`);
  console.log(`\n🏆 Your top 5 posts (by views):`);
  me.topPosts.slice(0, 5).forEach((p, i) => {
    const cap = p.caption.replace(/\s+/g, ' ').slice(0, 60) || '(no caption)';
    console.log(`   ${i + 1}. ${p.views.toLocaleString()} views · ${p.likes.toLocaleString()} likes · ${p.type}`);
    console.log(`      "${cap}"  ${p.url || ''}`);
  });
  console.log(`\n📊 Competitors:`);
  competitors.forEach((c) => {
    const top = c.topPosts[0];
    console.log(`   @${c.username}: ${c.followers.toLocaleString()} followers · ${c.postsPulled} posts pulled · top = ${top ? top.views.toLocaleString() + ' views' : 'n/a'}`);
  });
  console.log('');
}

main().catch((e) => {
  console.error('\n❌ Pull failed:', e.message);
  console.error(e);
  process.exit(1);
});
