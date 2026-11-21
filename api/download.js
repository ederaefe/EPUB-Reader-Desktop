export default async function handler(req, res) {
  const { os } = req.query;
  const allowedPlatforms = ['win', 'mac', 'linux'];
  
  // 1. Strict Input Validation
  if (!os || !allowedPlatforms.includes(os)) {
    return res.status(400).send('Invalid or missing platform parameter.');
  }

  const owner = 'ederaefe';
  const repo = 'EPUB-Reader-Desktop';

  try {
    // 2. Fetch latest releases (including prereleases/betas) with a specific User-Agent
    let data = null;
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=5`, {
      headers: { 
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Semply-Download-Proxy' 
      }
    });
    
    if (response.ok) {
      const releases = await response.json();
      if (Array.isArray(releases) && releases.length > 0) {
        data = releases[0];
      }
    }

    if (!data) {
      // Fallback to /releases/latest
      const fallbackRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
        headers: { 
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Semply-Download-Proxy' 
        }
      });
      if (!fallbackRes.ok) throw new Error('Failed to fetch latest release from GitHub');
      data = await fallbackRes.json();
    }
    
    // 3. Find the asset matching the requested OS
    const asset = data.assets.find(a => {
      if (os === 'win') return a.name.endsWith('.exe') && !a.name.includes('portable');
      if (os === 'mac') return a.name.endsWith('.dmg');
      if (os === 'linux') return a.name.endsWith('.AppImage');
      return false;
    });

    if (asset) {
      // 4. Validate the redirect URL belongs to GitHub to prevent open-redirect attacks
      const url = new URL(asset.browser_download_url);
      if (url.hostname !== 'github.com' && url.hostname !== 'objects.githubusercontent.com') {
        throw new Error('Unsafe redirect target');
      }
      
      res.redirect(302, asset.browser_download_url);
    } else {
      res.status(404).send('No download found for this platform.');
    }
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).send('Security error processing download request.');
  }
}
