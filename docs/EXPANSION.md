# Content Expansion Notes

This project is intentionally shaped so the first version stays simple while the content can grow fast.

## Current content model

### Kana

Stored as arrays in `site/data.js`:

```js
[romanji, symbol]
```

This is enough for:
- recognition drills
- audio mapping
- writing quizzes
- randomized kana review

### Flashcards

Stored as objects in `site/data.js`:

```js
{
  id: "n5-taberu",
  stage: "n5",
  front: "食べる",
  back: "吃",
  reading: "taberu",
  hint: "一段动词"
}
```

This shape can be extended with:
- `partOfSpeech`
- `tags`
- `example`
- `audio`
- `mnemonic`
- `interval`
- `ease`
- `nextReviewAt`

### Grammar

Stored as objects in `site/data.js`:

```js
{
  id: "n2-wakenihaikanai",
  stage: "n2",
  title: "〜わけにはいかない",
  meaning: "不能……，不便……",
  structure: "动词辞书形 / ない形 + わけにはいかない",
  example: "大事な会議があるので、休むわけにはいかない。",
  note: "通常含有责任、立场或客观限制。"
}
```

This shape can be extended with:
- `jlpt`
- `category`
- `contrast`
- `commonMistakes`
- `moreExamples`
- `drillType`

## Recommended next data split

When the dataset grows, split `site/data.js` into:

- `site/data/kana.js`
- `site/data/vocab-n5.js`
- `site/data/vocab-n4.js`
- `site/data/vocab-n3.js`
- `site/data/vocab-n2.js`
- `site/data/grammar-n5.js`
- `site/data/grammar-n4.js`
- `site/data/grammar-n3.js`
- `site/data/grammar-n2.js`

## Recommended next features

1. Daily review queue based on spaced repetition
2. Search and filtering by tag, stage, and grammar type
3. Sync progress with Cloudflare D1
4. User-defined custom deck import
5. Audio playback and listening review
6. Mini quizzes for fill-in-the-blank grammar practice

## UI scaling notes

The current UI already supports staged filters. That means the same layout can continue to work when the content grows from tens of items to thousands of items, as long as we later add:

- pagination or lazy rendering
- search
- favorites
- review queue generation

## Deployment scaling notes

Current deployment is static-first on Cloudflare Pages.

That means we can expand in phases:

1. Static only: fastest and cheapest
2. Pages Functions: login, APIs, review queue generation
3. D1: synced progress, custom decks, analytics
4. R2: audio files and larger content assets
