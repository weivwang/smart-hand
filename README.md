# Smart Hand

用自然语言控制一只机械手做出任意手势。LLM 不是查表匹配预定义手势，而是直接推理每根手指的弯曲角度。

说 "比个耶" → LLM 推理出食指和中指伸直 → 机械手做出手势

说 "假装弹钢琴" → LLM 生成手指交替按下的动画序列 → 机械手弹起来

## 核心思路

传统方案把语音指令映射到预定义手势，本质上 LLM 只是做了个分类器。

Smart Hand 让 LLM 直接输出每根手指的角度值（0°-180°），静态手势输出一帧，动态动作输出多帧序列。LLM 的世界知识就是手势库，不需要提前定义任何动作。

## 架构

```
语音 → Whisper(语音转文字) → DeepSeek(推理手指角度) → Arduino → 5个舵机 → 机械手
```

- 语音识别：本地 whisper.cpp，无需 API Key
- 意图推理：DeepSeek API（默认），也支持 Ollama 本地模型
- 硬件控制：TypeScript 通过串口发送角度指令给 Arduino

## 硬件清单

| 组件 | 参考价格 |
|------|---------|
| 5自由度机械手爪套件（含舵机） | ¥150-400 |
| Arduino Mega 2560 | ¥45 |
| PCA9685 舵机驱动板 | ¥15 |
| 5V 5A 电源适配器 | ¥25 |
| 杜邦线、USB数据线 | ¥20 |

总计约 ¥250 - ¥500

## 接线

1. Arduino Mega → PCA9685（I2C：SDA/SCL）
2. PCA9685 通道 0-4 → 5个舵机
3. PCA9685 → 独立 5V 5A 电源（舵机电流大，不能只靠 USB）
4. Arduino → 笔记本（USB）

## 快速开始

### 前置条件

- Node.js >= 18
- macOS: `brew install sox whisper-cpp` / Ubuntu: `sudo apt install sox` + 自行编译 whisper.cpp
- Arduino IDE（用于烧录固件）
- 下载 Whisper 模型：`mkdir models && curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin -o models/ggml-small.bin`

### 1. 烧录 Arduino 固件

1. 用 Arduino IDE 打开 `firmware/smart_hand.ino`
2. 安装库：Adafruit PWM Servo Driver Library
3. 选择 Arduino Mega 2560，上传

### 2. 安装软件

```bash
git clone https://github.com/weivwang/smart-hand.git
cd smart-hand
npm install
cp .env.example .env
```

编辑 `.env`，填入你的 DeepSeek API Key：
```
DEEPSEEK_API_KEY=your_key_here
```

### 3. 运行

```bash
npm run dev
```

按空格键开始录音，说完自动停止。

## 配置

编辑 `config/default.yaml` 可以切换 LLM 提供商、调整舵机参数、修改语音检测灵敏度。

### 使用本地模型（Ollama）

```yaml
llm:
  provider: ollama
  ollama:
    model: llama3
    baseUrl: http://localhost:11434/v1
```

## License

MIT
