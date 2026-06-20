const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kbpyxboleoefwvdnjcod.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticHl4Ym9sZW9lZnd2ZG5qY29kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg2NjYyNCwiZXhwIjoyMDk3NDQyNjI0fQ.KS0GG_in6M6ZMr02WRhXx8L3URpnW2xgKdu5W7KIfa8';

const supabase = createClient(supabaseUrl, serviceKey);

async function setup() {
  console.log('開始建立資料表...\n');

  // 1. 診所資料
  const { error: clinicErr } = await supabase.from('clinics').upsert({
    id: 1,
    name: '賜安診所',
    phone: '(05) 260-0934',
    address: '嘉義縣水上鄉正義路 53 號',
    line_id: '@334snxnh',
    facebook_url: 'https://www.facebook.com/suanclinic?locale=zh_TW',
    hours_morning: '08:00-12:00',
    hours_afternoon: '15:00-18:00',
    hours_evening: '18:30-20:30',
    services: ['一般內科', '小兒科', '耳鼻喉科', '皮膚科', '成人健檢', '兒童健檢', '疫苗注射']
  }, { onConflict: 'id' });

  if (clinicErr) console.log('clinics:', clinicErr.message);

  // 2. 建立 doctors 資料表
  const doctors = [
    { 
      id: 1, 
      name: '周見成', 
      title: '院長', 
      specialties: ['預防保健', '兒童預防注射', '小兒科', '一般內科', '家醫科', '兒童腸胃', '耳鼻喉科', '青春痘', '濕疹', '蟹足腫', '肥胖性疤痕', '過敏', '皮膚搔癢', '蕁麻疹', '藥物疹', '香港腳', '灰指甲', '癬', '外傷傷口治療', '富貴手', '酒糟', '血管擴張', '皰疹', '小兒尿布疹', '異位性皮膚炎', '冬季癢', '水痘', '禿頭', '落髮', '汗斑', '白斑', '乾癬', '疥瘡', '雞眼', '病毒疣', '甲溝炎'], 
      education: '長庚大學醫學系畢業', 
      experience: '高雄長庚醫院兒童內科部住院醫師、林口長庚醫院兒童腸胃科研究员、高雄長庚醫院兒童腸胃科主治醫師、中華民國小兒科專科醫師、台灣兒科消化醫學次專科醫師、中華民國消化系醫學會會員', 
      color: '#3498DB' 
    },
    { 
      id: 2, 
      name: '鄭名傑', 
      title: '醫師', 
      specialties: ['一般內科', '小兒科', '耳鼻喉科', '青春痘', '濕疹', '蟹足腫', '肥胖性疤痕', '過敏', '皮膚搔癢', '蕁麻疹', '藥物疹', '香港腳', '灰指甲', '癬', '外傷傷口治療', '富貴手', '酒糟', '血管擴張', '皰疹', '小兒尿布疹', '異位性皮膚炎', '冬季癢', '水痘', '禿頭', '落髮', '汗斑', '白斑', '乾癬', '疥瘡', '雞眼', '病毒疣', '甲溝炎'], 
      education: '', 
      experience: '嘉義基督教醫院內科醫師、戴昌隆皮膚科診所專任醫師', 
      color: '#E74C3C' 
    },
    { 
      id: 3, 
      name: '石逸仁', 
      title: '醫師', 
      specialties: ['一般內科', '小兒科', '耳鼻喉科', '青春痘', '濕疹', '蟹足腫', '肥胖性疤痕', '過敏', '皮膚搔癢', '蕁麻疹', '藥物疹', '香港腳', '灰指甲', '癬', '外傷傷口治療', '富貴手', '酒糟', '血管擴張', '皰疹', '小兒尿布疹', '異位性皮膚炎', '冬季癢', '水痘', '禿頭', '落髮', '汗斑', '白斑', '乾癬', '疥瘡', '雞眼', '病毒疣', '甲溝炎'], 
      education: '', 
      experience: '奇美醫院內科醫師、嘉義基督教醫院內科醫師、戴昌隆皮膚科診所專任醫師、USMLE 美國醫師考試及格', 
      color: '#27AE60' 
    }
  ];

  const { error: doctorErr } = await supabase.from('doctors').upsert(doctors, { onConflict: 'id' });
  if (doctorErr) console.log('doctors:', doctorErr.message);

  // 3. 建立 services 資料表
  const services = [
    { id: 1, name: '成人健康檢查', category: '預防保健', description: '40歲以上免費成人健康檢查' },
    { id: 2, name: 'B型肝炎篩檢', category: '預防保健', description: '免費B型肝炎篩檢' },
    { id: 3, name: 'C型肝炎篩檢', category: '預防保健', description: '免費C型肝炎篩檢' },
    { id: 4, name: '兒童預防保健', category: '兒童健康', description: '兒童生長發育評估' },
    { id: 5, name: '兒童疫苗注射', category: '疫苗', description: 'B型肝炎、五合一、肺炎鏈球菌等（由周見成醫師執行，請安排周醫師門診時段）' },
    { id: 6, name: '流感疫苗', category: '疫苗', description: '每年流感疫苗注射' },
    { id: 7, name: '門診抽血檢查', category: '檢驗', description: '血糖、血脂肪、腎功能檢查' }
  ];

  const { error: serviceErr } = await supabase.from('services').upsert(services, { onConflict: 'id' });
  if (serviceErr) console.log('services:', serviceErr.message);

  // 4. 建立 pharmacies 資料表
  const { error: pharmErr } = await supabase.from('pharmacies').upsert({
    id: 1,
    name: '宏益藥局',
    phone: '05260-1714',
    address: '嘉義縣水上鄉正義路 51 號',
    hours: '08:00-12:00 / 15:00-18:00 / 18:30-20:30'
  }, { onConflict: 'id' });
  if (pharmErr) console.log('pharmacies:', pharmErr.message);

  // 5. 測試讀取
  console.log('\n測試讀取資料...\n');

  const { data: clinics, error: cErr } = await supabase.from('clinics').select('*');
  console.log('診所:', clinics, cErr?.message);

  const { data: doctors2, error: dErr } = await supabase.from('doctors').select('*');
  console.log('醫師:', doctors2, dErr?.message);

  const { data: services2, error: sErr } = await supabase.from('services').select('*');
  console.log('服務項目:', services2, sErr?.message);

  const { data: pharms, error: pErr } = await supabase.from('pharmacies').select('*');
  console.log('藥局:', pharms, pErr?.message);

  console.log('\n完成！');
}

setup().catch(console.error);