const express = require('express');
const cors = require('cors');
const gplay = require('google-play-scraper');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

async function getExactApkSize(appId) {
  try {
    const res = await axios.head(`https://d.apkpure.com/b/APK/${appId}?version=latest`, {
      maxRedirects: 5,
      timeout: 3000
    });
    const contentLength = res.headers['content-length'];
    if (contentLength) {
      const bytes = parseInt(contentLength, 10);
      if (bytes > 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  } catch (err) {
    // Fallback on size estimation fail
  }
  return null;
}

function formatAppSummary(item) {
  const score = item.score ? item.score.toFixed(1) : '4.6';
  return {
    appId: item.appId || item.id,
    id: item.appId || item.id,
    title: item.title,
    developer: item.developer,
    icon: item.icon,
    rating: score,
    scoreText: score,
    summary: item.summary || item.description || 'Available now',
    free: item.free !== undefined ? item.free : true
  };
}

app.get('/api/user/profile', (req, res) => {
  res.json({
    name: 'Alex Developer',
    email: 'alex.dev@apple.com',
    status: 'Google Play & App Store Account',
    avatar: 'https://ui-avatars.com/api/?name=Alex+Developer&size=150&background=0A84FF&color=fff'
  });
});

app.get('/api/trending', async (req, res) => {
  try {
    const results = await gplay.search({
      term: 'top free apps',
      num: 20,
      fullDetail: false
    });
    res.json(results.map(formatAppSummary));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trending apps' });
  }
});

app.get('/api/apps', async (req, res) => {
  const category = (req.query.category || 'ALL').toUpperCase();
  const page = parseInt(req.query.page, 10) || 1;
  const perPage = 12;

  const queryMap = {
    ALL: 'top free apps',
    UTILITIES: 'best utility tools',
    GAMES: 'top action games'
  };

  try {
    const results = await gplay.search({
      term: queryMap[category] || queryMap.ALL,
      num: 60,
      fullDetail: false
    });

    const formatted = results.map(formatAppSummary);
    const startIdx = (page - 1) * perPage;
    const paginated = formatted.slice(startIdx, startIdx + perPage);

    res.json({
      page,
      has_more: startIdx + perPage < formatted.length,
      data: paginated
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch apps feed' });
  }
});

app.get('/api/search', async (req, res) => {
  const query = req.query.q || '';
  if (!query.trim()) return res.json([]);

  try {
    const results = await gplay.search({
      term: query,
      num: 24,
      fullDetail: false
    });
    res.json(results.map(formatAppSummary));
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/app/:id', async (req, res) => {
  const appId = req.params.id;
  try {
    const playData = await gplay.app({ appId });
    const reviewsData = await gplay.reviews({
      appId,
      sort: gplay.sort.HELPFULNESS,
      num: 8
    });

    let finalSize = playData.size || 'Varies with device';
    if (!finalSize || finalSize.toLowerCase().includes('varies')) {
      const exactSize = await getExactApkSize(appId);
      finalSize = exactSize || (playData.genre === 'Game' ? '1.8 GB' : '85.4 MB');
    }

    res.json({
      appId: playData.appId,
      title: playData.title,
      developer: playData.developer,
      icon: playData.icon,
      banner: playData.headerImage || playData.icon,
      rating: playData.score ? playData.score.toFixed(1) : '4.6',
      ratingsCount: playData.ratings || 0,
      contentRating: playData.contentRating || '12+',
      size: finalSize,
      installs: playData.installs || '1M+',
      genre: playData.genre || 'App',
      summary: playData.summary || 'Featured Application',
      description: playData.descriptionHTML || playData.description,
      screenshots: playData.screenshots || [],
      reviews: reviewsData.data.map(r => ({
        userName: r.userName || 'User',
        score: r.score || 5,
        date: r.date || 'Recent',
        content: r.text || ''
      }))
    });
  } catch (error) {
    res.status(404).json({ error: 'App details not found' });
  }
});

app.get('/api/get-apk-url', async (req, res) => {
  const query = req.query.s || 'app';
  try {
    const searchUrl = `https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(query)}&bundles%5B%5D=apkm_bundles&bundles%5B%5D=apk_files`;
    const searchRes = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const $ = cheerio.load(searchRes.data);
    const releasePath = $('.appRow .title').first().attr('href');

    if (!releasePath) return res.status(404).json({ error: 'Release not found' });

    const releaseRes = await axios.get(`https://www.apkmirror.com${releasePath}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const $release = cheerio.load(releaseRes.data);
    const downloadPagePath = $release('a.downloadButton').attr('href');

    const finalRes = await axios.get(`https://www.apkmirror.com${downloadPagePath}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const $final = cheerio.load(finalRes.data);
    const directUrl = $final('a[rel="nofollow"][data-google-vignette="false"]').attr('href');

    res.json({ apkUrl: directUrl ? `https://www.apkmirror.com${directUrl}` : null });
  } catch (err) {
    res.status(500).json({ error: 'Scraping failed' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`App Store Server running on http://localhost:${PORT}`));