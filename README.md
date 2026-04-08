# 🤖 Smart Hand — AI 语音控制机械手

> 用自然语言控制一只机械手做出任意手势。AI 不是查表，而是直接推理每根手指该怎么动。

说 "比个耶" → AI 推理出食指和中指伸直 → 机械手做出手势

说 "假装弹钢琴" → AI 生成手指交替按下的动画序列 → 机械手弹起来

## ✨ 核心创新

传统方案：语音 → 匹配预定义手势 → 查表执行（本质是分类器）

**Smart Hand：语音 → LLM 直接推理每根手指的弯曲角度 → 执行任意动作**

LLM 的世界知识就是你的手势库 — 无需提前定义任何手势。

## 🏗️ 架构

```
语音 → Whisper(语音转文字) → DeepSeek(推理手指角度) → Arduino → 5个舵机 → 机械手
```

## 📦 硬件清单

| 组件 | 参考价格 |
|------|---------|
| 5自由度机械手爪套件（含舵机） | ¥150-400 |
| Arduino Mega 2560 | ¥45 |
| PCA9685 舵机驱动板 | ¥15 |
| 5V 5A 电源适配器 | ¥25 |
| 杜邦线、USB数据线 | ¥20 |

**总计：¥250 - ¥500**

## 🔌 接线

1. Arduino Mega → PCA9685（I2C：SDA/SCL）
2. PCA9685 通道 0-4 → 5个舵机
3. PCA9685 → 独立 5V 5A 电源
4. Arduino → 笔记本（USB）

## 🚀 快速开始

### 前置条件

- Node.js >= 18
- macOS: `brew install sox` / Ubuntu: `sudo apt install sox`
- Arduino IDE（用于烧录固件）

### 1. 烧录 Arduino 固件

1. 用 Arduino IDE 打开 `firmware/smart_hand.ino`
2. 安装库：Adafruit PWM Servo Driver Library
3. 选择 Arduino Mega 2560，上传

### 2. 安装软件

```bash
git clone https://github.com/your-name/smart-hand.git
cd smart-hand
npm install
cp .env.example .env
```

编辑 `.env`，填入你的 API Key：
```
DEEPSEEK_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here  # for Whisper
```

### 3. 运行

```bash
npm run dev
```

然后对着麦克风说话！

## ⚙️ 配置

编辑 `config/default.yaml` 可以：

- 切换 LLM 提供商（DeepSeek / Ollama）
- 调整舵机参数
- 修改语音检测灵敏度

### 使用本地模型（Ollama）

```yaml
llm:
  provider: ollama
  ollama:
    model: llama3
    baseUrl: http://localhost:11434/v1
```

## 📄 License

MIT
