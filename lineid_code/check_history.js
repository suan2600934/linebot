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
      WHERE table_name = 'line_user_links_history'
      ORDER BY ordinal_position
    `);
    console.log('=== line_user_links_history 欄位結構 ===');
    cols.rows.forEach(r => console.log(r.column_name, '|', r.data_type, '| nullable:', r.is_nullable));

    const sample = await client.query('SELECT * FROM line_user_links_history LIMIT 3');
    console.log('\n=== 範例資料 ===');
    sample.rows.forEach((row, i) => {
      console.log(`\nRow ${i+1}:`, JSON.stringify(row, null, 2));
    });

    const actions = await client.query('SELECT DISTINCT action FROM line_user_links_history');
    console.log('\n=== action 值有哪些 ===');
    console.log(actions.rows.map(r => r.action).join(', ') || '(空)');
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e => console.error(e));