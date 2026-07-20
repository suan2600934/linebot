const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.kbpyxboleoefwvdnjcod:awSDlKU0zaobAa7D@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'line_user_links'
      ORDER BY ordinal_position
    `);
    console.log('=== line_user_links 欄位結構 ===');
    cols.rows.forEach(r => console.log(r.column_name, '|', r.data_type, '| nullable:', r.is_nullable));

    const sample = await client.query('SELECT * FROM line_user_links LIMIT 1');
    console.log('\n=== 範例資料 ===');
    if (sample.rows.length > 0) {
      console.log('Columns:', Object.keys(sample.rows[0]).join(', '));
      const row = sample.rows[0];
      for (const [k, v] of Object.entries(row)) {
        console.log(`  ${k}: ${JSON.stringify(v)}`);
      }
    } else {
      console.log('(空資料)');
    }

    const statuses = await client.query('SELECT DISTINCT status FROM line_user_links');
    console.log('\n=== status 值有哪些 ===');
    console.log(statuses.rows.map(r => r.status).join(', ') || '(空)');
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e => console.error(e));