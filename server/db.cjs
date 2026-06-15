/**
 * 数据库适配层
 * 统一 SQLite 和 PostgreSQL 接口，让业务代码不需要关心底层数据库
 * 生产环境默认用 PostgreSQL，单机版回退到 SQLite
 */

const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

function createDatabaseAdapter(config) {
  const mode = config?.mode || 'sqlite'; // 'sqlite' | 'postgres'
  let adapter = null;

  if (mode === 'postgres') {
    const connectionString = config?.connectionString || `postgresql://${config?.user || 'bibooks'}:${config?.password || 'bibooks'}@${config?.host || 'localhost'}:${config?.port || 5432}/${config?.database || 'bibooks'}`;
    adapter = new PostgresAdapter(connectionString);
  } else {
    const dbPath = config?.dbPath || path.join(__dirname, '..', 'data', 'bibooks.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    adapter = new SqliteAdapter(dbPath);
  }

  return adapter;
}

class PostgresAdapter {
  constructor(connectionString) {
    this.pool = new Pool({ connectionString });
    this.isPostgres = true;
  }

  async query(text, params = []) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getOne(text, params = []) {
    const rows = await this.query(text, params);
    return rows[0] || null;
  }

  async run(text, params = []) {
    await this.query(text, params);
  }

  async all(text, params = []) {
    return this.query(text, params);
  }

  async transaction(fn) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const tx = {
        query: (text, params = []) => client.query(text, params),
        getOne: async (text, params = []) => {
          const res = await client.query(text, params);
          return res.rows[0] || null;
        },
        all: async (text, params = []) => client.query(text, params).then(r => r.rows),
        run: async (text, params = []) => client.query(text, params),
      };
      await fn(tx);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

class SqliteAdapter {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.isPostgres = false;
  }

  query(text, params = []) {
    const stmt = this.db.prepare(text);
    return stmt.all(params);
  }

  getOne(text, params = []) {
    const stmt = this.db.prepare(text);
    return stmt.get(params);
  }

  run(text, params = []) {
    const stmt = this.db.prepare(text);
    return stmt.run(params);
  }

  all(text, params = []) {
    return this.query(text, params);
  }

  transaction(fn) {
    return this.db.transaction(fn)();
  }

  close() {
    this.db.close();
  }
}

module.exports = { createDatabaseAdapter };
