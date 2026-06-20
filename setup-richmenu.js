const fs = require('fs');
const path = require('path');
require('dotenv').config();

const line = require('@line/bot-sdk');

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

async function createRichMenu() {
  try {
    console.log('📋 開始建立 Rich Menu...');
    
    // 1. 讀取選單設定
    const richMenuPath = path.join(__dirname, 'richmenu.json');
    const richMenu = JSON.parse(fs.readFileSync(richMenuPath, 'utf-8'));
    
    // 2. 建立 Rich Menu
    console.log('建立 Rich Menu 物件...');
    const richMenuId = await client.createRichMenu(richMenu);
    console.log('✅ Rich Menu ID:', richMenuId);
    
    // 3. 上傳選單圖片
    console.log('上傳選單圖片...');
    const imagePath = path.join(__dirname, 'richmenu-image.png');
    
    // 檢查圖片是否存在
    if (!fs.existsSync(imagePath)) {
      console.log('⚠️  圖片不存在，使用預設圖片生成...');
      await createDefaultImage(imagePath);
    }
    
    const imageBuffer = fs.readFileSync(imagePath);
    await client.setRichMenuImage(richMenuId, imageBuffer);
    console.log('✅ 圖片上傳成功');
    
    // 4. 設定為預設選單（所有使用者）
    console.log('設定為預設選單...');
    await client.setDefaultRichMenu(richMenuId);
    console.log('✅ 預設選單設定成功');
    
    console.log('\n🎉 Rich Menu 建立完成！');
    console.log('選單 ID:', richMenuId);
    console.log('\n請在 LINE App 中重新開啟聊天視窗查看選單');
    
  } catch (error) {
    console.error('❌ 錯誤:', error.message);
    if (error.originalError) {
      console.error('詳細錯誤:', error.originalError);
    }
  }
}

// 建立預設圖片（如果沒有圖片檔）
async function createDefaultImage(imagePath) {
  const { createCanvas } = require('canvas');
  
  const canvas = createCanvas(2500, 1686);
  const ctx = canvas.getContext('2d');
  
  const W = 2500;
  const H = 1686;
  const btnW = Math.floor(W / 3);
  const btnH = H / 2;
  
  // 背景 - 米白色
  ctx.fillStyle = '#FFF8F0';
  ctx.fillRect(0, 0, W, H);
  
  // 分隔線 - 淺灰色
  ctx.strokeStyle = '#E0D0C0';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(btnW, 0);
  ctx.lineTo(btnW, H);
  ctx.moveTo(btnW * 2, 0);
  ctx.lineTo(btnW * 2, H);
  ctx.moveTo(0, btnH);
  ctx.lineTo(W, btnH);
  ctx.stroke();
  
  // 上排按鈕
  ctx.fillStyle = '#A8D8EA'; // 馬卡龍藍
  ctx.fillRect(2, 2, btnW - 4, btnH - 4);
  
  ctx.fillStyle = '#FFB7B2'; // 馬卡龍粉
  ctx.fillRect(btnW + 2, 2, btnW - 4, btnH - 4);
  
  ctx.fillStyle = '#B5EAD7'; // 馬卡龍綠
  ctx.fillRect(btnW * 2 + 2, 2, btnW - 4, btnH - 4);
  
  // 下排按鈕
  ctx.fillStyle = '#E2C7F0'; // 馬卡龍紫（分享LINE）
  ctx.fillRect(2, btnH + 2, btnW - 4, btnH - 4);
  
  ctx.fillStyle = '#FFDAC1'; // 馬卡龍橙（預防保健）
  ctx.fillRect(btnW + 2, btnH + 2, btnW - 4, btnH - 4);
  
  ctx.fillStyle = '#C7CEEA'; // 馬卡龍淡紫（兒童預防注射）
  ctx.fillRect(btnW * 2 + 2, btnH + 2, btnW - 4, btnH - 4);
  
  // 文字設定 - 100px 白字黑邊
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 100px "Microsoft JhengHei", "PingFang TC", sans-serif';
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 3;
  
  const centerX1 = btnW / 2;
  const centerX2 = btnW + btnW / 2;
  const centerX3 = btnW * 2 + btnW / 2;
  const centerY1 = btnH / 2;
  const centerY2 = btnH + btnH / 2;
  
  // 上排文字
  ctx.fillStyle = '#2C5F7C';
  ctx.fillText('診所藥局資訊', centerX1, centerY1 - 80);
  ctx.fillText('Clinic Info', centerX1, centerY1 + 20);
  
  ctx.fillStyle = '#8B4557';
  ctx.fillText('醫師介紹', centerX2, centerY1 - 80);
  ctx.fillText('Doctor Intro', centerX2, centerY1 + 20);
  
  ctx.fillStyle = '#3D6B54';
  ctx.fillText('醫師門診表', centerX3, centerY1 - 80);
  ctx.fillText('Schedule', centerX3, centerY1 + 20);
  
  // 下排文字
  ctx.fillStyle = '#6B4C7A';
  ctx.fillText('分享LINE', centerX1, centerY2 - 80);
  ctx.fillText('Share LINE', centerX1, centerY2 + 20);
  
  ctx.fillStyle = '#8B5A2B';
  ctx.fillText('預防保健檢查', centerX2, centerY2 - 80);
  ctx.fillText('Health Exam', centerX2, centerY2 + 20);
  
  ctx.fillStyle = '#4A5568';
  ctx.fillText('兒童預防注射', centerX3, centerY2 - 80);
  ctx.fillText('Vaccine', centerX3, centerY2 + 20);
  
  // 儲存圖片
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(imagePath, buffer);
  console.log('✅ 圖片已生成:', imagePath);
}

// 執行（預設只生成預覽圖）
const args = process.argv.slice(2);
if (args.includes('--upload')) {
  createRichMenu();
} else {
  console.log('📝 預覽模式：使用 node setup-richmenu.js --upload 才會上傳到 LINE');
  createDefaultImage(path.join(__dirname, 'richmenu-image.png'));
}