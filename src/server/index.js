import express from 'express';
import multer from 'multer';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import unzipper from 'unzipper';
import { nanoid } from 'nanoid';

import { assertControlPlaneEnv, config } from '../config/env.js';
import { uploadFile, objectExists } from '../services/r2.js';
import { putHostMapping, getHostMapping, deleteHostMapping } from '../services/kv.js';
import { walkDir } from '../utils/fs.js';

assertControlPlaneEnv();

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 200 } }); // 200MB

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// POST /publish multipart form:
// fields: tenant (string), version (optional), host (string), root (optional default index.html)
// file: archive (zip of site root)
app.post('/publish', upload.single('archive'), async (req, res) => {
  try {
    const tenant = String(req.body.tenant || '').trim();
    const host = String(req.body.host || '').trim();
    const version = String(req.body.version || '') || nanoid(8);
    let rootFile = String(req.body.root || 'index.html');
    const userProvidedRoot = Object.prototype.hasOwnProperty.call(req.body, 'root');

    if (!tenant) return res.status(400).json({ error: 'tenant required' });
    if (!host) return res.status(400).json({ error: 'host required' });
    if (!req.file) return res.status(400).json({ error: 'archive file required' });

    // Extract to temp dir
    const dir = await fs.mkdtemp(path.join(tmpdir(), 'site-'));
    await unzipper.Open.buffer(req.file.buffer).then(d => d.extract({ path: dir, concurrency: 8 }));
    // If the ZIP contains a single top-level folder, use it as the root
    let contentRoot = dir;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const visible = entries.filter(e => !e.name.startsWith('__MACOSX') && !e.name.startsWith('.'));
      if (visible.length === 1 && visible[0].isDirectory()) {
        contentRoot = path.join(dir, visible[0].name);
      }
    } catch {}

    // Enumerate files to validate/resolve root file
    const absFiles = [];
    for await (const absPath of walkDir(contentRoot)) absFiles.push(absPath);
    const relFiles = absFiles.map(p => path.relative(contentRoot, p).split(path.sep).join('/'));

    if (userProvidedRoot) {
      if (!relFiles.includes(rootFile)) {
        return res.status(400).json({ error: `root file '${rootFile}' not found in archive`, files: relFiles.slice(0, 50) });
      }
    } else {
      if (!relFiles.includes(rootFile)) {
        if (relFiles.includes('index.html')) {
          rootFile = 'index.html';
        } else {
          const htmlCandidates = relFiles.filter(f => /\.(html?|HTML?)$/.test(f));
          if (htmlCandidates.length === 1) {
            rootFile = htmlCandidates[0];
          } else {
            return res.status(400).json({
              error: `No index.html found and root not provided; please set 'root' to your entry HTML file`,
              candidates: htmlCandidates.slice(0, 50),
            });
          }
        }
      }
    }

    let uploaded = 0;
    for (const absPath of absFiles) {
      await uploadFile({ tenant, version, rootDir: contentRoot, absPath });
      uploaded++;
    }

    // Map host to {tenant, version, root}
    const mapping = { tenant, version, root: rootFile };
    await putHostMapping(host, mapping);

    const url = `https://${host}`;
    res.json({ ok: true, uploaded, mapping, url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /mapping: update host mapping without upload
// body: { host, tenant, version, root? }
app.use(express.json());
app.post('/mapping', async (req, res) => {
  try {
    const { host, tenant, version, root = 'index.html' } = req.body || {};
    if (!host || !tenant || !version) return res.status(400).json({ error: 'host, tenant, version required' });
    await putHostMapping(String(host), { tenant: String(tenant), version: String(version), root: String(root) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /unpublish: remove host mapping
// body: { host }
app.post('/unpublish', async (req, res) => {
  try {
    const { host } = req.body || {};
    if (!host) return res.status(400).json({ error: 'host required' });
    const mapping = await getHostMapping(String(host));
    await deleteHostMapping(String(host));
    res.json({ ok: true, host, mapping });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`staticdeployer control plane listening on http://localhost:${PORT}`);
});

// Lightweight debug helpers
app.get('/mapping', async (req, res) => {
  try {
    const host = String(req.query.host || '').trim();
    if (!host) return res.status(400).json({ error: 'host required' });
    const mapping = await getHostMapping(host);
    res.json({ host, mapping });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/debug', async (req, res) => {
  try {
    const host = String(req.query.host || '').trim();
    if (!host) return res.status(400).json({ error: 'host required' });
    const mapping = await getHostMapping(host);
    if (!mapping) return res.json({ host, mapping: null, exists: false });
    const { tenant, version, root = 'index.html' } = mapping;
    const key = `sites/${tenant}/${version}/${root}`;
    const exists = await objectExists(key);
    res.json({ host, mapping, key, exists });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
