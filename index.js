const express = require('express');
const line = require('@line/bot-sdk');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Node.js < 22 的 WebSocket 修補
try {
  const WebSocket = require('ws');
  if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = WebSocket;
  }
} catch (e) {
  console.log('ws package not found, WebSocket polyfill skipped');
}

// Supabase 客戶端
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://kbpyxboleoefwvdnjcod.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticHl4Ym9sZW9lZnd2ZG5qY29kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg2NjYyNCwiZXhwIjoyMDk3NDQyNjI0fQ.KS0GG_in6M6ZMr02WRhXx8L3URpnW2xgKdu5W7KIfa8'
);

const app = express();

// Supabase Storage URL（圖片 CDN）
const STORAGE_URL = 'https://kbpyxboleoefwvdnjcod.supabase.co/storage/v1/object/public/images';

// 建立 Messaging API 客戶端
const messagingApiClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

// 從 Supabase 載入知識庫
async function loadKnowledgeBase() {
  try {
    const { data: clinic } = await supabase.from('clinics').select('*').eq('id', 1).single();
    const { data: doctors } = await supabase.from('doctors').select('*');
    const { data: services } = await supabase.from('services').select('*');
    const { data: pharmacies } = await supabase.from('pharmacies').select('*');

    let kb = '';

    if (clinic) {
      kb += `【診所資訊】
名稱：${clinic.name}
電話：${clinic.phone}
地址：${clinic.address}
早診：${clinic.hours_morning}
午診：${clinic.hours_afternoon}
晚診：${clinic.hours_evening}
服務項目：${clinic.services?.join('、') || ''}
`;
    }

    if (doctors && doctors.length > 0) {
      kb += `\n【醫師團隊】
`;
      for (const d of doctors) {
        kb += `${d.name}（${d.title}）- 專長：${d.specialties?.join('、') || ''}
`;
      }
    }

    if (services && services.length > 0) {
      kb += `\n【服務項目】
`;
      for (const s of services) {
        kb += `${s.name}：${s.description}
`;
      }
    }

    if (pharmacies && pharmacies.length > 0) {
      kb += `\n【附近藥局】
`;
      for (const p of pharmacies) {
        kb += `${p.name}
電話：${p.phone}
地址：${p.address}
時間：${p.hours}
`;
      }
    }

    return kb;
  } catch (error) {
    console.error('載入知識庫失敗:', error.message);
    return '';
  }
}

// NVIDIA NIM AI 回覆
async function callNIM(userMessage) {
  const knowledgeBase = await loadKnowledgeBase();
  
  const today = new Date();
  const rocYear = today.getFullYear() - 1911;
  const month = today.getMonth() + 1;
  const date = today.getDate();
  const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  const weekday = weekdays[today.getDay()];
  const todayStr = `民國${rocYear}年${month}月${date}日（${weekday}）`;
  
  let processedMessage = userMessage
    .replace(/今天/g, ` ${month}/${date}（${weekday}） `)
    .replace(/明天/g, ` ${month}/${date + 1}（${weekdays[(today.getDay() + 1) % 7]}） `)
    .replace(/後天/g, ` ${month}/${date + 2}（${weekdays[(today.getDay() + 2) % 7]}） `)
    .replace(/這週|這星期|這周/g, `本週（${month}/${date} 所屬週）`);
  
  const systemPrompt = `你是「賜安診所」的醫療資訊助理。

【今日日期】${todayStr}

【診所基本資訊】
- 名稱：賜安診所
- 電話：(05) 260-0934
- 地址：嘉義縣水上鄉正義路 53 號
- 門診時間：早診 08:00-12:00 / 午診 15:00-18:00 / 晚診 18:30-20:30

【醫師團隊】
1. 周見成（院長）- 專長：小兒科、兒童腸胃、兒童營養
2. 鄭名傑 - 專長：一般內科、小兒科、耳鼻喉科、皮膚問題
3. 石逸仁 - 專長：一般內科、小兒科、耳鼻喉科、皮膚問題

【附近藥局】
- 宏益藥局：嘉義縣水上鄉正義路 51 號，電話 05260-1714

【知識庫】（請從中找答案回答用戶）
${knowledgeBase}

【重要原則】
1. 只提供公開資訊，不透露醫師私人資訊
2. 不提供醫療建議、診斷或用藥指導
3. 如有症狀請直接就醫
4. 回答簡潔，最多 300 字
5. 用繁體中文回覆
6. 如果知識庫沒有答案，說「抱歉，這個問題我無法回答，建議致電診所 (05) 260-0934 詢問」`;

  try {
    const response = await axios.post(
      process.env.NIM_API_URL + '/chat/completions',
      {
        model: process.env.NIM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: processedMessage }
        ],
        temperature: 0.7,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.NIM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const reply = response.data.choices[0].message.content;
    return {
      type: 'text',
      text: reply
    };
  } catch (error) {
    console.error('NIM API 錯誤:', error.message);
    if (error.response) {
      console.error('NIM 回應:', error.response.data);
      if (error.response.status === 429) {
        return {
          type: 'text',
          text: '目前訊息較多，請稍後再試。（Rate Limit）'
        };
      }
    }
    return {
      type: 'text',
      text: '抱歉，AI 回覆系統目前忙碌中，請稍後再試或致電診所 (05) 260-0934'
    };
  }
}

// 中間件
app.use(cors());
app.use(express.json());

// LINE webhook 驗證（加入詳細除錯）
app.post('/webhook', async (req, res) => {
  try {
    console.log('=== Webhook 請求開始 ===');
    console.log('請求標頭:', JSON.stringify(req.headers, null, 2));
    console.log('請求內容:', JSON.stringify(req.body, null, 2));
    
    // 驗證簽章（生產模式：缺少簽章直接拒絕）
    const signature = req.headers['x-line-signature'];
    const body = JSON.stringify(req.body);
    
    if (!signature) {
      console.log('缺少簽章，拒绝請求');
      return res.status(400).json({ error: 'Missing x-line-signature header' });
    }
    
    console.log('驗證簽章...');
    const isValid = line.validateSignature(body, process.env.LINE_CHANNEL_SECRET, signature);
    console.log('簽章驗證結果:', isValid ? '成功' : '失敗');
    
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid signature' });
    }
    
    // 處理事件
    const events = req.body.events;
    
    // 如果是空事件（LINE 測試連線），直接回 200
    if (!events || events.length === 0) {
      console.log('收到空事件（LINE 測試連線），回傳 200');
      res.status(200).end();
      return;
    }
    
    console.log('收到 webhook 事件:', events.length);
    
    for (const event of events) {
      console.log('處理事件類型:', event.type);
      
      if (event.type === 'message' && event.message.type === 'text') {
        await handleTextMessage(event);
      } else if (event.type === 'postback') {
        await handlePostback(event);
      } else if (event.type === 'follow') {
        await handleFollow(event);
      }
    }
    
    console.log('=== Webhook 處理完成 ===');
    res.status(200).end();
  } catch (error) {
    console.error('=== Webhook 錯誤 ===');
    console.error('錯誤類型:', error.constructor.name);
    console.error('錯誤訊息:', error.message);
    console.error('錯誤堆疊:', error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// 處理文字訊息
async function handleTextMessage(event) {
  const userId = event.source.userId;
  const text = event.message.text.trim();
  
  // 輸入長度限制（防止惡意灌 prompt 或 token 爆量）
  if (text.length > 2000) {
    await messagingApiClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: 'text',
        text: '抱歉，您的訊息過長（超過2000字），請縮短內容後再試。'
      }]
    });
    return;
  }
  
  let replyMessage;
  
  // 門診表查詢（數字選擇）
  if (text === '1') {
    replyMessage = await getThisWeekSchedule();
  } else if (text === '2') {
    replyMessage = await getFullMonthSchedule();
  }
  // 醫師名字查詢
  else if (text.includes('周見成') || text.includes('鄭名傑') || text.includes('石逸仁')) {
    replyMessage = await handleDoctorQuery(text);
  }
  // AI 聊天式回覆（檢索資料庫）
  else if (text.includes('附近') || text.includes('哪裡') || text.includes('推薦')) {
    replyMessage = await handleAIQuery(text);
  }
  // 關鍵字匹配
  else if (text.includes('藥局') || text.includes('診所')) {
    replyMessage = await handleKeywordSearch(text);
  }
  // AI 回覆（所有未匹配的訊息）
  else {
    replyMessage = await callNIM(text);
  }
  
  await messagingApiClient.replyMessage({
    replyToken: event.replyToken,
    messages: Array.isArray(replyMessage) ? replyMessage : [replyMessage]
  });
}

// 處理按鍵回傳
async function handlePostback(event) {
  const data = event.postback.data;
  let replyMessage;
  
  if (data === 'action=share_line') {
    replyMessage = {
      type: 'text',
      text: '【分享賜安診所官方 LINE】\n\nLINE ID：@334snxnh\n\n在 LINE App 中搜尋「@334snxnh」即可找到我們！'
    };
  } else if (data === 'action=clinic_pharmacy_info') {
    replyMessage = await getClinicPharmacyInfo();
  } else if (data === 'action=doctor_intro') {
    replyMessage = await getDoctorIntro();
  } else if (data === 'action=schedule') {
    replyMessage = await getSchedule();
  } else if (data === 'action=hours_info') {
    replyMessage = await getHoursInfo();
  } else if (data === 'action=faq') {
    replyMessage = await getFaq();
  } else if (data === 'search_pharmacy') {
    replyMessage = await searchPharmacies();
  } else if (data === 'search_clinic') {
    replyMessage = await searchClinics();
  } else if (data === 'action=health_exam') {
    replyMessage = await getHealthExam();
  } else if (data === 'action=child_vaccine') {
    replyMessage = await getChildVaccine();
  }

  await messagingApiClient.replyMessage({
    replyToken: event.replyToken,
    messages: Array.isArray(replyMessage) ? replyMessage : [replyMessage]
  });
}

// ========== Rich Menu 回覆函式 ==========

// 診所藥局資訊
async function getClinicPharmacyInfo() {
  return {
    type: 'text',
    text: `🏥 【賜安診所】

📞 電話：(05) 260-0934
📍 地址：嘉義縣水上鄉正義路 53 號

⏰ 【門診時間】
早診 08:00-12:00
午診 15:00-18:00
晚診 18:30-20:30

📋 【主治項目】
一般內科：高血壓、糖尿病、感冒、過敏氣喘、關節炎、痛風
小兒科：兒童健檢、兒童疫苗、小兒感染症、腸胃科
耳鼻喉科：一般耳鼻喉疾病
皮膚科：青春痘、濕疹、過敏、蕁麻疹、香港腳、灰指甲

💉 【服務】
超音波檢查、心電圖檢查、成人健檢、兒童健檢、疫苗注射

━━━━━━━━━━━━━━━
🏪 【附近藥局】

宏益藥局
📞 電話：05260-1714
📍 地址：嘉義縣水上鄉正義路 51 號
⏰ 時間：08:00-12:00 / 15:00-18:00 / 18:30-20:30`
  };
}

// 醫師介紹（從 Supabase 讀取）
async function getDoctorIntro() {
  try {
    const { data: doctors, error } = await supabase
      .from('doctors')
      .select('*')
      .order('id');

    if (error || !doctors || doctors.length === 0) {
      return { type: 'text', text: '目前無法取得醫師資訊，請稍後再試。' };
    }

    let text = '【醫師團隊】\n\n';

    for (const d of doctors) {
      const titleText = d.title ? `（${d.title}）` : '';
      const expList = d.experience ? d.experience.split('、').map(e => `• ${e}`).join('\n') : '';
      const specList = d.specialties ? d.specialties.join('、') : '';

      text += `━━━━━━━━━━━━━━━
🩺 ${d.name} 醫師${titleText}
${d.education ? `學歷：${d.education}\n` : ''}${d.experience ? `經歷：\n${expList}\n` : ''}專長：${specList}\n`;
    }

    return { type: 'text', text: text.trim() };
  } catch (err) {
    console.error('getDoctorIntro error:', err);
    return { type: 'text', text: '取得醫師資訊時發生錯誤。' };
  }
}

// 醫師門診表（當月）
async function getSchedule() {
  return {
    type: 'text',
    text: `【115年6月門診班表】

請問您要查詢：
1️⃣ 本週門診表（6/15-6/21）
2️⃣ 完整月份班表（6/1-6/30）`
  };
}

// 本週門診表
async function getThisWeekSchedule() {
  const imageUrl = STORAGE_URL + '/schedule-week3.png';
  return [
    {
      type: 'text',
      text: '【本週門診表】(6/15-6/21)\n\n如圖所示，輸入 2 可查看完整月份班表'
    },
    {
      type: 'image',
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl
    }
  ];
}

// 完整月份班表
async function getFullMonthSchedule() {
  const imageUrl = STORAGE_URL + '/schedule-full-month.jpg';
  return [
    {
      type: 'text',
      text: '【115年6月門診班表】\n\n如圖所示'
    },
    {
      type: 'image',
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl
    }
  ];
}

// 門診時間（詳細版）
async function getHoursInfo() {
  return {
    type: 'text',
    text: `⏰ 【門診時間】

早診 08:00-12:00
午診 15:00-18:00
晚診 18:30-20:30

📌 【注意事項】
• 請攜帶健保卡
• 電話預約 (05) 260-0934
• 星期日病患較多，不開放預約
• 未帶健保卡押單看診，多收300元押金
  （還押單期限：次月6日前）`
  };
}

// 常見問題
async function getFaq() {
  return {
    type: 'text',
    text: `❓ 【常見問題】

1️⃣ 如何掛號？
可現場掛號或電話預約 (05) 260-0934

2️⃣ 需要攜帶什麼？
健保卡、身分證（初診）

3️⃣ 有兒童疫苗嗎？
是的，請先電話詢問庫存

4️⃣ 可以打流感疫苗嗎？
可以，請在門診時段前來

5️⃣ 有看中醫嗎？
目前僅提供西醫門診

━━━━━━━━━━━━━━━
💬 還有其他問題？直接問我喔！`
  };
}

// ========== 以下是原有函式 ==========

// 處理追蹤
async function handleFollow(event) {
  await messagingApiClient.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'text',
      text: '感謝追蹤！我是醫療資訊小幫手，可以查詢藥局和診所資訊。\n\n點選下方選單開始使用吧！'
    }]
  });
}

// AI 查詢（檢索式）
async function handleAIQuery(query) {
  const lowerQuery = query.toLowerCase();
  
  // 根據關鍵字回覆對應資訊
  if (lowerQuery.includes('醫師') || lowerQuery.includes('周見成') || lowerQuery.includes('鄭名傑') || lowerQuery.includes('石逸仁')) {
    return await getDoctorIntro();
  }
  
  if (lowerQuery.includes('門診表') || lowerQuery.includes('班表') || lowerQuery.includes('看診時間')) {
    return await getSchedule();
  }
  
  if (lowerQuery.includes('地址') || lowerQuery.includes('在哪') || lowerQuery.includes('地點')) {
    return {
      type: 'text',
      text: `📍 賜安診所位置

地址：嘉義縣水上鄉正義路 53 號

🗺️ 附近地標：
• 水上鄉公所
• 7-11 水上門市

🚗 交通指引：
• 開車：省道台1線水上段
• 公車：水上鄉免費巴士（正義路站）`
    };
  }
  
  if (lowerQuery.includes('電話') || lowerQuery.includes('預約')) {
    return {
      type: 'text',
      text: `📞 聯絡資訊

電話：(05) 260-0934

可電話預約，節省等待時間！
也歡迎使用 LINE 官方帳號詢問。`
    };
  }
  
  if (lowerQuery.includes('小兒') || lowerQuery.includes('兒童') || lowerQuery.includes('疫苗')) {
    return {
      type: 'text',
      text: `🧒 兒童醫療服務

主治醫師：周見成醫師、鄭名傑醫師

服務項目：
• 兒童健檢
• 嬰幼兒疫苗接种
• 過敏、氣喘治療
• 感冒發燒

💉 可接种疫苗：
卡介苗、B型肝炎、五合一等

請在門診時段攜帶健保卡及兒童健康手冊前來。`
    };
  }
  
  if (lowerQuery.includes('高血壓') || lowerQuery.includes('糖尿病') || lowerQuery.includes('慢性病')) {
    return {
      type: 'text',
      text: `🏥 慢性病照護

主治醫師：周見成醫師、石逸仁醫師

服務項目：
• 高血壓追蹤控制
• 糖尿病血糖管理
• 慢性病處方籤

💊 貼心服務：
慢性病連續處方籤，省去每次回診領藥的麻煩。

歡迎攜帶過往病歷前来就診。`
    };
  }
  
  if (lowerQuery.includes('收費') || lowerQuery.includes('掛號費') || lowerQuery.includes('自費')) {
    return {
      type: 'text',
      text: `💰 收費說明

依據健保局規定收費，具體費用以現場公告為準。

一般就診：
• 健保部分負擔
• 掛號費

自費項目：
• 診斷書：100-200元
• 部分藥品不在健保範圍

💡 建議就診時詢問櫃台人員，了解確切費用。`
    };
  }
  
  if (lowerQuery.includes('便民') || lowerQuery.includes('掛號') || lowerQuery.includes('健保')) {
    return {
      type: 'text',
      text: `📋 便民服務

【掛號須知】
• 攜帶健保卡
• 初診請帶身分證
• 可電話預約 (05) 260-0934

【健保服務】
• 成人健康檢查（40歲以上）
• 兒童預防保健
• 流感疫苗接种
• 慢性病連續處方籤`
    };
  }
  
  if (lowerQuery.includes('藥局')) {
    return {
      type: 'text',
      text: `🏪 附近藥局

宏益藥局
📍 嘉義縣水上鄉正義路 51 號
📞 0928-532519
⏰ 週日 08:00-12:00, 15:00-18:00, 18:30-20:30

可持處方箋前往領藥。`
    };
  }
  
  // 預設回覆
  return {
    type: 'text',
    text: `感謝您的詢問！

我可以幫您查詢：
• 醫師門診時間
• 診所地址與電話
• 醫師專長介紹
• 兒科/慢性病服務
• 掛號與收費資訊
• 附近藥局

請直接輸入您想知道的問題，例如：
「今天誰看早診？」
「診所地址在哪？」
「鄭醫師專長什麼？」`
  };
}

// 處理醫師查詢
async function handleDoctorQuery(text) {
  if (text.includes('周見成')) {
    return {
      type: 'text',
      text: `【周見成 醫師（院長）6月門診】

每週固定看診日：
週一、週二、週四、週五 早診
部分晚診時段也有看診

建議輸入「2」查看完整月份班表確認

專長：小兒科、兒童腸胃、兒童營養`
    };
  } else if (text.includes('鄭名傑')) {
    return {
      type: 'text',
      text: `【鄭名傑 醫師 6月門診】

每週看診時間不固定，詳見班表

建議輸入「2」查看完整月份班表

專長：一般內科、小兒科、耳鼻喉科`
    };
  } else if (text.includes('石逸仁')) {
    return {
      type: 'text',
      text: `【石逸仁 醫師 6月門診】

每週看診時間不固定，詳見班表

建議輸入「2」查看完整月份班表

專長：一般內科、小兒科、耳鼻喉科`
    };
  } else {
    return {
      type: 'text',
      text: '請輸入完整的醫師姓名：周見成、鄭名傑、或石逸仁'
    };
  }
}

// 關鍵字搜尋
async function handleKeywordSearch(text) {
  // TODO: 實作資料庫搜尋
  return {
    type: 'text',
    text: `搜尋關鍵字：${text}\n\n目前系統正在測試中，稍後將提供完整搜尋功能！`
  };
}

// 搜尋藥局
async function searchPharmacies() {
  // TODO: 從資料庫查詢
  return {
    type: 'text',
    text: '藥局清單（測試中）\n\n宏益藥局\n地址：嘉義縣水上鄉正義路 51 號\n電話：0928-532519'
  };
}

// 搜尋診所
async function searchClinics() {
  // TODO: 從資料庫查詢
  return {
    type: 'text',
    text: '診所清單（測試中）\n\n賜安診所\n地址：嘉義縣水上鄉正義路 53 號\n電話：05-2600934'
  };
}

// 預防保健檢查
async function getHealthExam() {
  const imageUrl = STORAGE_URL + '/health_exam.jpg';
  return [
    {
      type: 'text',
      text: '【預防保健檢查】\n\n提供以下成人健康檢查服務：\n\n✅ 成人健康檢查（30歲以上）\n✅ 免費B型、C型肝炎篩檢\n✅ 大腸癌篩檢\n\n⚠️ 提醒：成人健康檢查由周見成醫師執行，請安排在周醫師門診時段前來。'
    },
    {
      type: 'image',
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl
    }
  ];
}

// 兒童預防注射
async function getChildVaccine() {
  const imageUrl = STORAGE_URL + '/child_vaccine.jpg';
  return [
    {
      type: 'text',
      text: '【兒童預防注射】\n\n提供幼兒疫苗注射服務：\n\n✅ B型肝炎疫苗\n✅ 五合一疫苗\n✅ 肺炎鏈球菌疫苗\n✅ 卡介苗\n✅ 水痘疫苗\n✅ 麻疹腮腺炎德國麻疹疫苗\n\n💉 請攜帶兒童健康手冊，電話預約 (05) 260-0934\n\n⚠️ 提醒：兒童預防注射由周見成醫師執行，請家長安排在周醫師門診時段帶小朋友前來。'
    },
    {
      type: 'image',
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl
    }
  ];
}

// 健康檢查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 提供班表圖片（支援 /images/xxx.png 和 /images/xxx.jpg）
app.get('/images/:filename', (req, res) => {
  const filename = req.params.filename;
  let imagePath = path.join(__dirname, 'images', filename);
  if (!fs.existsSync(imagePath)) {
    imagePath = path.join(__dirname, filename);
  }
  if (fs.existsSync(imagePath)) {
    res.sendFile(imagePath);
  } else {
    res.status(404).send('Image not found: ' + filename);
  }
});

// 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 LINE Bot 伺服器已啟動，監聽端口 ${PORT}`);
});