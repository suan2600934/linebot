const fs = require('fs');
const path = require('path');
require('dotenv').config();

const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

async function setup() {
  try {
    console.log('=== 開始設定 Rich Menu ===\n');
    
    // 1. 建立 Rich Menu 物件
    const richMenu = {
      size: { width: 2500, height: 1686 },
      selected: false,
      name: '醫療資訊選單',
      chatBarText: '選單',
      areas: [
        {
          bounds: { x: 0, y: 0, width: 1250, height: 843 },
          action: { type: 'postback', data: 'action=search_pharmacy' }
        },
        {
          bounds: { x: 1250, y: 0, width: 1250, height: 843 },
          action: { type: 'postback', data: 'action=search_clinic' }
        },
        {
          bounds: { x: 0, y: 843, width: 1250, height: 843 },
          action: { type: 'postback', data: 'action=hours_info' }
        },
        {
          bounds: { x: 1250, y: 843, width: 1250, height: 843 },
          action: { type: 'postback', data: 'action=faq' }
        }
      ]
    };
    
    console.log('1. 建立 Rich Menu 物件...');
    const richMenuId = await client.createRichMenu(richMenu);
    console.log('✅ Rich Menu ID:', richMenuId);
    
    // 2. 上傳圖片
    console.log('\n2. 上傳圖片...');
    const imagePath = path.join(__dirname, 'richmenu-image.png');
    
    if (!fs.existsSync(imagePath)) {
      console.error('❌ 圖片不存在:', imagePath);
      console.log('請先執行 node setup-richmenu.js 生成圖片');
      return;
    }
    
    const imageBuffer = fs.readFileSync(imagePath);
    await client.setRichMenuImage(richMenuId, imageBuffer);
    console.log('✅ 圖片上傳成功');
    
    // 3. 設定為預設選單
    console.log('\n3. 設定為預設選單...');
    await client.setDefaultRichMenu(richMenuId);
    console.log('✅ 預設選單設定成功');
    
    console.log('\n🎉 完成！');
    console.log('請在 LINE App 中重新開啟聊天視窗查看選單');
    console.log('如果看不到，請嘗試：');
    console.log('  1. 關閉並重新開啟 LINE App');
    console.log('  2. 移除 Bot 後重新加入');
    
  } catch (error) {
    console.error('\n❌ 錯誤:', error.message);
    if (error.originalError) {
      console.error('詳細資訊:', JSON.stringify(error.originalError, null, 2));
    }
    console.error('堆疊:', error.stack);
  }
}

setup();