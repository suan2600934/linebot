require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
(async () => {
  const { error } = await supabase
    .from('schedules')
    .insert({
      year: 2026,
      month: 8,
      week_number: 6,
      week_label: '第六週',
      week_content: '早診：週一周\n午診：週一鄭\n晚診：週一石'
    });
  if (error) console.error('Insert error:', error);
  else console.log('第六週已插入');
})();