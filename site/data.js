export const stages = [
  {
    id: "kana",
    label: "五十音",
    summary: "认识平假名与片假名，建立发音和拼读基础。"
  },
  {
    id: "starter",
    label: "入门",
    summary: "掌握问候、数字、时间、基础动词与常用表达。"
  },
  {
    id: "n5",
    label: "N5",
    summary: "能理解基础句型、日常对话和简单阅读。"
  },
  {
    id: "n4",
    label: "N4",
    summary: "进入更完整的生活表达，建立较稳定的语法感。"
  },
  {
    id: "n3",
    label: "N3",
    summary: "从生活日语过渡到较复杂说明、意见和连接表达。"
  },
  {
    id: "n2",
    label: "N2",
    summary: "强化书面语、抽象表达和正式场景理解。"
  }
];

export const kana = {
  hiragana: [
    ["a", "あ"], ["i", "い"], ["u", "う"], ["e", "え"], ["o", "お"],
    ["ka", "か"], ["ki", "き"], ["ku", "く"], ["ke", "け"], ["ko", "こ"],
    ["sa", "さ"], ["shi", "し"], ["su", "す"], ["se", "せ"], ["so", "そ"],
    ["ta", "た"], ["chi", "ち"], ["tsu", "つ"], ["te", "て"], ["to", "と"],
    ["na", "な"], ["ni", "に"], ["nu", "ぬ"], ["ne", "ね"], ["no", "の"],
    ["ha", "は"], ["hi", "ひ"], ["fu", "ふ"], ["he", "へ"], ["ho", "ほ"],
    ["ma", "ま"], ["mi", "み"], ["mu", "む"], ["me", "め"], ["mo", "も"],
    ["ya", "や"], ["yu", "ゆ"], ["yo", "よ"],
    ["ra", "ら"], ["ri", "り"], ["ru", "る"], ["re", "れ"], ["ro", "ろ"],
    ["wa", "わ"], ["wo", "を"], ["n", "ん"]
  ],
  katakana: [
    ["a", "ア"], ["i", "イ"], ["u", "ウ"], ["e", "エ"], ["o", "オ"],
    ["ka", "カ"], ["ki", "キ"], ["ku", "ク"], ["ke", "ケ"], ["ko", "コ"],
    ["sa", "サ"], ["shi", "シ"], ["su", "ス"], ["se", "セ"], ["so", "ソ"],
    ["ta", "タ"], ["chi", "チ"], ["tsu", "ツ"], ["te", "テ"], ["to", "ト"],
    ["na", "ナ"], ["ni", "ニ"], ["nu", "ヌ"], ["ne", "ネ"], ["no", "ノ"],
    ["ha", "ハ"], ["hi", "ヒ"], ["fu", "フ"], ["he", "ヘ"], ["ho", "ホ"],
    ["ma", "マ"], ["mi", "ミ"], ["mu", "ム"], ["me", "メ"], ["mo", "モ"],
    ["ya", "ヤ"], ["yu", "ユ"], ["yo", "ヨ"],
    ["ra", "ラ"], ["ri", "リ"], ["ru", "ル"], ["re", "レ"], ["ro", "ロ"],
    ["wa", "ワ"], ["wo", "ヲ"], ["n", "ン"]
  ]
};

export const flashcards = [
  {
    id: "starter-ohayou",
    stage: "starter",
    front: "おはよう",
    back: "早上好",
    reading: "ohayou",
    hint: "日常早晨问候"
  },
  {
    id: "starter-mizu",
    stage: "starter",
    front: "水",
    back: "水",
    reading: "mizu",
    hint: "最早接触的常用名词"
  },
  {
    id: "n5-taberu",
    stage: "n5",
    front: "食べる",
    back: "吃",
    reading: "taberu",
    hint: "一段动词"
  },
  {
    id: "n5-tomodachi",
    stage: "n5",
    front: "友達",
    back: "朋友",
    reading: "tomodachi",
    hint: "基础人际关系词"
  },
  {
    id: "n4-junbi",
    stage: "n4",
    front: "準備",
    back: "准备",
    reading: "junbi",
    hint: "生活与工作高频词"
  },
  {
    id: "n4-tsuzukeru",
    stage: "n4",
    front: "続ける",
    back: "继续",
    reading: "tsuzukeru",
    hint: "动作延续"
  },
  {
    id: "n3-erabu",
    stage: "n3",
    front: "選ぶ",
    back: "选择",
    reading: "erabu",
    hint: "意见表达常见动词"
  },
  {
    id: "n3-jouhou",
    stage: "n3",
    front: "情報",
    back: "信息",
    reading: "jouhou",
    hint: "阅读与新闻常见词"
  },
  {
    id: "n2-kentou",
    stage: "n2",
    front: "検討",
    back: "研究，探讨",
    reading: "kentou",
    hint: "书面和正式场景高频"
  },
  {
    id: "n2-igai",
    stage: "n2",
    front: "意外",
    back: "意外，出乎意料",
    reading: "igai",
    hint: "抽象理解和表达"
  }
];

export const grammar = [
  {
    id: "n5-desu",
    stage: "n5",
    title: "A は B です",
    meaning: "A 是 B",
    structure: "名词 + は + 名词 + です",
    example: "私は学生です。",
    note: "最基础的判断句型。"
  },
  {
    id: "n5-masu",
    stage: "n5",
    title: "ます形",
    meaning: "礼貌体现在日常交流中非常高频",
    structure: "动词词干 + ます",
    example: "毎日、日本語を勉強します。",
    note: "先熟悉礼貌体，再过渡到普通体。"
  },
  {
    id: "n4-teiru",
    stage: "n4",
    title: "〜ている",
    meaning: "表示正在进行或状态持续",
    structure: "动词て形 + いる",
    example: "今、本を読んでいます。",
    note: "既可以表示动作进行，也可以表示结果状态。"
  },
  {
    id: "n4-nakerebanaranai",
    stage: "n4",
    title: "〜なければならない",
    meaning: "必须，不得不",
    structure: "动词ない形去い + ければならない",
    example: "明日、早く起きなければならない。",
    note: "书面感稍强，但考试和生活里都常见。"
  },
  {
    id: "n3-youni",
    stage: "n3",
    title: "〜ように",
    meaning: "为了，希望达到某种状态",
    structure: "动词辞书形 / ない形 + ように",
    example: "忘れないように、メモします。",
    note: "与“ために”相比，更常接非意志或状态目标。"
  },
  {
    id: "n3-koto-ni-suru",
    stage: "n3",
    title: "〜ことにする",
    meaning: "决定做……",
    structure: "动词辞书形 / ない形 + ことにする",
    example: "毎日三十分走ることにしました。",
    note: "用于表达自己做出的决定。"
  },
  {
    id: "n2-wakenihaikanai",
    stage: "n2",
    title: "〜わけにはいかない",
    meaning: "不能……，不便……",
    structure: "动词辞书形 / ない形 + わけにはいかない",
    example: "大事な会議があるので、休むわけにはいかない。",
    note: "通常含有责任、立场或客观限制。"
  },
  {
    id: "n2-koto-kara",
    stage: "n2",
    title: "〜ことから",
    meaning: "由于……，从……可以看出",
    structure: "普通形 + ことから",
    example: "彼の表情が暗いことから、何かあったと分かった。",
    note: "书面推论表达，N2 很常见。"
  }
];
