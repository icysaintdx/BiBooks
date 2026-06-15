/**
 * SQLite → PostgreSQL 迁移脚本
 * 用法: node migrate-sqlite-to-postgres.cjs [sqlite_path] [postgres_url]
 *
 * 示例:
 *   node migrate-sqlite-to-postgres.cjs
 *   node migrate-sqlite-to-postgres.cjs ./data/bibooks.db postgresql://bibooks:bibooks@localhost:5432/bibooks
 */

const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('node:path');
const fs = require('node:fs');

// 默认路径
const defaultSqlitePath = path.join(__dirname, '..', 'data', 'bibooks.db');

function main() {
  const sqlitePath = process.argv[2] || defaultSqlitePath;
  const pgUrl = process.argv[3] || process.env.DATABASE_URL || 'postgresql://bibooks:bibooks@localhost:5432/bibooks';

  if (!fs.existsSync(sqlitePath)) {
    console.error(`[ERROR] SQLite 数据库不存在: ${sqlitePath}`);
    process.exit(1);
  }

  console.log(`[INFO] 源数据库: ${sqlitePath}`);
  console.log(`[INFO] 目标数据库: ${maskUrl(pgUrl)}`);
  console.log('');

  // 1. 连接 SQLite
  const sqliteDb = new Database(sqlitePath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');

  // 获取所有表
  const tables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log(`[INFO] 发现 ${tables.length} 个表`);

  // 2. 连接 PostgreSQL
  const pool = new Pool({ connectionString: pgUrl });
  const pgClient = new (require('pg').Client)({ connectionString: pgUrl });

  async function run() {
    await pgClient.connect();
    await pgClient.query('BEGIN');

    try {
      // 3. 对每张表：建表 + 迁移数据
      for (const { name: tableName } of tables) {
        console.log(`[MIGRATE] ${tableName}`);

        // 获取 SQLite 表结构
        const pragma = sqliteDb.prepare(`PRAGMA table_info(${tableName})`).all();
        const columns = pragma.map(c => ({ name: c.name, type: c.sql_type || c.type, notnull: c.notnull, dflt_value: c.dflt_value, pk: c.pk }));

        // 构建 PostgreSQL 表结构
        const pgColumns = columns.map(c => {
          let pgType = mapColumnType(c.type);
          let parts = [`"${c.name}" ${pgType}`];
          if (c.pk && c.type.toLowerCase().includes('int')) parts.push('PRIMARY KEY');
          if (c.notnull && !c.pk) parts.push('NOT NULL');
          if (c.dflt_value !== null && c.dflt_value !== undefined) parts.push(`DEFAULT ${c.dflt_value}`);
          return parts.join(' ');
        });

        const createTable = `CREATE TABLE IF NOT EXISTS "${tableName}" (${pgColumns.join(', ')})`;
        await pgClient.query(createTable);
        console.log(`  [OK] 建表完成`);

        // 迁移数据
        const rows = sqliteDb.prepare(`SELECT * FROM "${tableName}"`).all();
        if (rows.length > 0) {
          const colNames = Object.keys(rows[0]);
          const placeholders = colNames.map((_, i) => `$${i + 1}`).join(', ');
          const insertSql = `INSERT INTO "${tableName}" ("${colNames.join('", "')}") VALUES (${placeholders})`;

          for (const row of rows) {
            const values = colNames.map(col => {
              const val = row[col];
              // PostgreSQL 不识别 SQLite 的整数类型字面量
              if (typeof val === 'number') return val;
              return val;
            });
            await pgClient.query(insertSql, values);
          }
          console.log(`  [OK] 迁移 ${rows.length} 条数据`);
        } else {
          console.log(`  [SKIP] 无数据`);
        }
      }

      await pgClient.query('COMMIT');
      console.log('');
      console.log('[SUCCESS] 迁移完成！');
      console.log(`[INFO] 请检查 PostgreSQL 中的数据结构，确认无误后删除 SQLite 数据库。`);
    } catch (error) {
      await pgClient.query('ROLLBACK');
      console.error('[ERROR]', error.message);
      process.exit(1);
    } finally {
      sqliteDb.close();
      await pgClient.end();
    }
  }

  run();
}

function mapColumnType(sqliteType) {
  if (!sqliteType) return 'TEXT';
  const t = sqliteType.toLowerCase();
  if (t.includes('int')) return 'INTEGER';
  if (t.includes('bool')) return 'BOOLEAN';
  if (t.includes('real') || t.includes('float') || t.includes('double')) return 'DOUBLE PRECISION';
  if (t.includes('text') || t.includes('varchar') || t.includes('char')) return 'TEXT';
  if (t.includes('blob')) return 'BYTEA';
  return 'TEXT';
}

function maskUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}:${u.port}/****`;
  } catch {
    return url.split(':').pop() || url;
  }
}

main();
