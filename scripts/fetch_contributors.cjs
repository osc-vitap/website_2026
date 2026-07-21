const https = require('https');
const fs = require('fs');

const options = {
  hostname: 'api.github.com',
  path: '/orgs/osc-vitap/members',
  headers: {
    'User-Agent': 'Node.js/OSC-VITAP-Bot',
    ...(process.env.GITHUB_TOKEN ? { 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}` } : {})
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (!Array.isArray(json)) {
        console.error("Error: Did not receive an array from GitHub API.", json);
        process.exit(1);
      }
      const mapped = json.map(member => ({
        login: member.login,
        avatar_url: member.avatar_url,
        html_url: member.html_url
      }));
      const fileContent = `export const contributorsData = ${JSON.stringify(mapped, null, 2)};\n`;
      fs.writeFileSync('src/data/contributorsData.ts', fileContent);
      console.log('Successfully updated src/data/contributorsData.ts');
    } catch (e) {
      console.error("Error parsing response:", e);
      process.exit(1);
    }
  });
}).on('error', (e) => {
  console.error("Request failed:", e);
  process.exit(1);
});
