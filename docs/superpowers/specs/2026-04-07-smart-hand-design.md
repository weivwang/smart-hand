# Smart Hand — AI 语音控制机械手设计文档

## 项目概述

一个通过语音指令控制机械手做出任意手势的开源项目。核心创新点：LLM 不是查表匹配预定义手势，而是**直接推理每根手指的弯曲角度**，使机械手可以执行任何用自然语言描述的手势或动作。

**目标受众：** 投资人（Demo 视频）+ 开源社区（GitHub 项目）

**时间线：** 2-3 周

## 系统架构

```
用户语音 → 麦克风 → [笔记本 TypeScript 程序] → USB 串口 → Arduino → 舵机 → 机械手
```

### 四层流水线

1. **语音采集层 (audio/)** — 麦克风录音 + Whisper API 语音转文字
2. **意图推理层 (llm/)** — DeepSeek API 理解指令，直接推理 5 根手指的角度
3. **动作编排层 (motion/)** — 帧序列解析 + 帧间平滑插值
4. **硬件通信层 (serial/)** — USB 串口发送角度指令给 Arduino

### 关键设计决策

- **LLM 作为"运动皮层"：** LLM 接收自然语言指令，输出每根手指的角度帧序列。静态手势 = 1 帧，动态动作（如弹钢琴）= 多帧序列。不需要维护手势库，LLM 的世界知识就是手势库。
- **笔记本作为大脑：** 所有智能逻辑在笔记本上运行（TypeScript），Arduino 只负责驱动舵机。最大化利用软件开发优势，最小化硬件复杂度。
- **有线连接（USB）：** 比 WiFi 稳定，调试简单，2-3 周时间线下的最优选择。

## 硬件清单

| 组件 | 型号/规格 | 参考价格 |
|------|----------|---------|
| 机械手套件 | 5自由度机械手爪套件（含舵机） | ¥150-400 |
| 控制板 | Arduino Mega 2560 | ¥45 |
| 舵机驱动板 | PCA9685 16路PWM驱动板 | ¥15 |
| 电源 | 5V 5A 电源适配器 | ¥25 |
| 接线 | 杜邦线公对母 x40 | ¥8 |
| 数据线 | USB A to B | ¥10 |
| 面包板 | （可选）调试用 | ¥10 |

**总预算：¥250 - ¥500**

### 接线方案

- Arduino Mega 通过 I2C（SDA/SCL）连接 PCA9685 驱动板
- PCA9685 的通道 0-4 分别连接 5 个舵机（拇指/食指/中指/无名指/小指）
- PCA9685 使用独立 5V 5A 电源供电（舵机电流大，不能只靠 USB）
- Arduino 通过 USB 连接笔记本

## 软件设计

### 项目结构

```
smart-hand/
├── src/
│   ├── audio/
│   │   ├── recorder.ts        # 麦克风录音，VAD 静音检测
│   │   └── transcriber.ts     # Whisper API 语音转文字
│   ├── llm/
│   │   ├── provider.ts        # LLMProvider 抽象接口
│   │   ├── deepseek.ts        # DeepSeek API 实现（默认）
│   │   ├── ollama.ts          # Ollama 本地模型实现（可选）
│   │   └── prompts.ts         # System Prompt 模板
│   ├── motion/
│   │   ├── planner.ts         # LLM 输出 → 帧序列解析
│   │   └── interpolator.ts    # 帧间平滑插值（防抖动）
│   ├── serial/
│   │   ├── connection.ts      # 串口连接管理、自动重连
│   │   └── protocol.ts        # 指令编码/解码协议
│   ├── ui/
│   │   └── terminal.ts        # 终端 UI（状态显示、日志）
│   └── index.ts               # 主入口，串联所有模块
├── firmware/
│   └── smart_hand.ino         # Arduino 固件 (~60行)
├── config/
│   └── default.yaml           # 舵机校准、LLM配置、串口设置
└── package.json
```

### 模块详细设计

#### audio/ — 语音采集

**recorder.ts:**
- 使用 `node-record-lpcm16` 采集麦克风音频流
- 内置 VAD（Voice Activity Detection）：检测到说话开始录音，静音 1.5 秒后停止
- 输出 PCM 音频 Buffer

**transcriber.ts:**
- 将音频 Buffer 发送给语音识别服务
- 默认使用 OpenAI Whisper API（需 OpenAI API Key，费用极低：$0.006/分钟）
- 备选：本地 whisper.cpp 或其他免费 STT 方案（可后续扩展）
- 返回识别文本（支持中英文）
- 失败时重试 1 次

#### llm/ — 意图推理

**provider.ts:**
- 抽象接口 `LLMProvider`，方法：`infer(text: string): Promise<MotionPlan>`
- 工厂函数根据配置文件选择具体实现

**deepseek.ts（默认实现）:**
- 使用 `openai` npm 包，修改 baseURL 为 DeepSeek 端点
- DeepSeek API 兼容 OpenAI 格式，零额外学习成本
- 模型：`deepseek-chat`

**prompts.ts — System Prompt 核心设计：**
```
你正在控制一只机械手。它有5个舵机，分别控制5根手指：
- S0: 拇指
- S1: 食指
- S2: 中指
- S3: 无名指
- S4: 小指

每个舵机的角度范围是 0-180 度：
- 0 = 手指完全伸直
- 180 = 手指完全弯曲（握拳状态）

根据用户的指令，输出 JSON 格式的帧序列。
- 静态手势输出 1 帧
- 动态动作输出多帧（每帧间隔约 100ms）

输出格式：
{
  "frames": [
    { "s0": 0, "s1": 180, "s2": 180, "s3": 0, "s4": 0, "delay": 100 }
  ]
}

自主推理每根手指的角度，不要要求额外信息。
```

**ollama.ts（可选）:**
- 同样使用 `openai` npm 包，baseURL 指向 `http://localhost:11434/v1`
- 作为社区可选方案，README 中说明切换方法

#### motion/ — 动作编排

**planner.ts:**
- 解析 LLM 返回的 JSON
- 校验角度范围（clamp 到 0-180）
- 处理 LLM 格式异常（正则提取 JSON、重试）

**interpolator.ts:**
- 在相邻帧之间做线性插值
- 可配置插值步数（默认 5 步）
- 防止舵机瞬间跳变导致的抖动和机械冲击

#### serial/ — 硬件通信

**connection.ts:**
- 使用 `serialport` npm 包
- 自动扫描并检测 Arduino 串口
- 断线自动重连（轮询检测）
- 波特率：115200

**protocol.ts:**
- 文本协议：`"S0:90,S1:45,S2:120,S3:90,S4:60\n"`
- Arduino 解析后返回 `"OK\n"` 确认
- 超时 500ms 未收到 OK 则重发

#### ui/ — 终端界面

**terminal.ts:**
- 实时显示：当前状态（等待语音/识别中/推理中/执行中）
- 显示识别出的文本和 LLM 推理结果
- 拍视频时可以分屏展示

### 主循环 (index.ts)

```
while (true) {
  ① 等待语音输入（VAD 检测说话→静音）
  ② Whisper 转文字
  ③ DeepSeek 推理 → 帧序列 JSON
  ④ 插值生成平滑帧
  ⑤ 逐帧发送给 Arduino
  ⑥ 终端显示状态
}
```

### 配置文件 (config/default.yaml)

```yaml
llm:
  provider: deepseek          # deepseek | ollama
  deepseek:
    apiKey: ${DEEPSEEK_API_KEY}
    model: deepseek-chat
  ollama:
    model: llama3
    baseUrl: http://localhost:11434

audio:
  whisperApiKey: ${OPENAI_API_KEY}
  silenceThreshold: 1500      # ms，静音多久算说完

serial:
  baudRate: 115200
  autoDetect: true

motion:
  interpolationSteps: 5       # 帧间插值步数
  frameDelay: 100             # 帧间延迟 ms
```

## Arduino 固件设计

约 60 行 C++ 代码：

- 初始化：串口 115200 + PCA9685 驱动板
- 主循环：读取串口一行文本 → 解析 `S0:angle,...,S4:angle` → 设置舵机角度 → 回复 `OK`
- 依赖库：`Adafruit_PWMServoDriver`

## Demo 视频脚本（约 2-3 分钟）

1. **开场（15s）：** 镜头扫过硬件，旁白介绍项目
2. **基础手势（30s）：** "比个耶" "握拳" "OK手势" — 展示完整链路
3. **动态指令（30s）：** "数到5" "石头剪刀布" — 展示 AI 推理能力
4. **高光时刻（45s）：** "假装弹钢琴" "像蜘蛛一样爬" — 从未预定义的动作
5. **收尾（30s）：** 展示代码和开源仓库，讲述愿景

### 拍摄技巧

- 分屏画面：一边语音+机械手，一边终端日志
- USB 线从桌面后方走线
- 多录几遍选最佳 take
- 加轻快背景音乐

## 错误处理

- **语音识别失败：** 提示用户重新说一遍
- **LLM 返回格式异常：** 正则提取 JSON，失败则重试 1 次
- **串口断连：** 自动重连，终端提示状态
- **舵机角度越界：** clamp 到 0-180 范围

## 技术栈总结

| 层 | 技术 |
|----|------|
| 语言 | TypeScript (Node.js) |
| 语音识别 | OpenAI Whisper API |
| LLM | DeepSeek API（默认）/ Ollama（可选） |
| 串口通信 | serialport npm 包 |
| Arduino 固件 | C++ + Adafruit_PWMServoDriver |
| 配置 | YAML |
