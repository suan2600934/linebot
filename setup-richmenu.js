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
  const btnH = Math.floor(H / 3);
  
  // 背景 - 米白色
  ctx.fillStyle = '#FFF8F0';
  ctx.fillRect(0, 0, W, H);

  // 分隔線 - 淺灰色
  ctx.strokeStyle = '#E0D0C0';
  ctx.lineWidth = 4;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(btnW * i, 0);
    ctx.lineTo(btnW * i, H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, btnH * i);
    ctx.lineTo(W, btnH * i);
    ctx.stroke();
  }

  // 第 1 排按鈕（淺色對比字）
  ctx.fillStyle = '#C5E8F7';
  ctx.fillRect(2, 2, btnW - 4, btnH - 4);
  ctx.fillStyle = '#FFD6CC';
  ctx.fillRect(btnW + 2, 2, btnW - 4, btnH - 4);
  ctx.fillStyle = '#D4F0D4';
  ctx.fillRect(btnW * 2 + 2, 2, btnW - 4, btnH - 4);

  // 第 2 排按鈕
  ctx.fillStyle = '#FFE5CC';
  ctx.fillRect(2, btnH + 2, btnW - 4, btnH - 4);
  ctx.fillStyle = '#D9E8FF';
  ctx.fillRect(btnW + 2, btnH + 2, btnW - 4, btnH - 4);
  ctx.fillStyle = '#FFD6CC';
  ctx.fillRect(btnW * 2 + 2, btnH + 2, btnW - 4, btnH - 4);

  // 第 3 排按鈕
  ctx.fillStyle = '#C5E8F7';
  ctx.fillRect(2, btnH * 2 + 2, btnW - 4, btnH - 4);
  ctx.fillStyle = '#FFE5CC';
  ctx.fillRect(btnW + 2, btnH * 2 + 2, btnW - 4, btnH - 4);
  ctx.fillStyle = '#D9E8FF';
  ctx.fillRect(btnW * 2 + 2, btnH * 2 + 2, btnW - 4, btnH - 4);

  // 文字設定
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 105px "Microsoft JhengHei", "PingFang TC", sans-serif';
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 2;

  const labels = [
    ['診所藥局資訊', '醫師介紹', '醫師門診表'],
    ['看診進度', '預防保健檢查', '兒童預防注射'],
    ['分享LINE', '查詢就醫資訊', '門診時間']
  ];
  const textColors = ['#1A5F7A', '#8B4513', '#2E7D32', '#8B4513', '#1A5F7A', '#8B4513', '#2E7D32', '#8B4513', '#1A5F7A'];

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = col * btnW + btnW / 2;
      const cy = row * btnH + btnH / 2;
      const idx = row * 3 + col;
      ctx.fillStyle = textColors[idx];
      ctx.fillText(labels[row][col], cx, cy);
    }
  }
  
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