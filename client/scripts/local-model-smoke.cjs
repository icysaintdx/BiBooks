const http = require('node:http');
const assert = require('node:assert/strict');
const { createAiService } = require('../electron/services/aiService.cjs');

function createMockOpenAICompatibleServer() {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      requests.push({
        method: req.method,
        url: req.url,
        authorization: req.headers.authorization || '',
        body,
      });

      if (req.method === 'GET' && req.url === '/v1/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: [{ id: 'qwen2.5:7b-instruct' }, { id: 'deepseek-r1:7b' }] }));
        return;
      }

      if (req.method === 'POST' && req.url === '/v1/chat/completions') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          choices: [{ message: { content: 'local model ok' } }],
          usage: { prompt_tokens: 3, completion_tokens: 3, total_tokens: 6 },
        }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'not found' } }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, requests, baseUrl: `http://127.0.0.1:${address.port}/v1` });
    });
  });
}

(async () => {
  const mock = await createMockOpenAICompatibleServer();
  try {
    const config = {
      text_model_provider: 'ollama',
      api_key: '',
      base_url: mock.baseUrl,
      model_name: 'qwen2.5:7b-instruct',
      developer_mode: false,
    };
    const aiService = createAiService({
      app: { getVersion: () => '0.0.0', getPath: () => process.cwd() },
      configStore: { load: () => config },
    });

    const listResult = await aiService.listModels(config);
    assert.equal(listResult.success, true);
    assert.deepEqual(listResult.models, ['qwen2.5:7b-instruct', 'deepseek-r1:7b']);

    const chatResult = await aiService.chat({
      messages: [{ role: 'user', content: 'ping' }],
      temperature: 0,
    });
    assert.equal(chatResult, 'local model ok');

    const modelRequest = mock.requests.find((item) => item.url === '/v1/models');
    const chatRequest = mock.requests.find((item) => item.url === '/v1/chat/completions');
    assert.equal(modelRequest.authorization, '');
    assert.equal(chatRequest.authorization, '');

    console.log('local model smoke ok');
  } finally {
    await new Promise((resolve) => mock.server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
