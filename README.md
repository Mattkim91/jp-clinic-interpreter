# 진료 통역

A phone web app for a Korean physical therapist treating Japanese patients. Speak or type a Korean sentence and it becomes a large Japanese cue card, with hangul showing how to read the Japanese aloud. Tap a card to hear it in Japanese.

It is a static site: no server, no account, no API key. Translation uses a keyless Google endpoint. Japanese readings are computed on the phone.

## Run

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:41723](http://127.0.0.1:41723). `npm test` checks the hangul readings, polite endings, and the rehab phrases.

The microphone only works in a secure context. `localhost` counts. A phone opening this dev server over plain `http://` on the LAN will not get the mic. Deploy the build to HTTPS, or use a tunnel.

## Deploy

```bash
npm run build
```

Publish the `dist/` folder to any static host (GitHub Pages, Netlify, Cloudflare Pages). Paths are relative, so a project site such as `https://user.github.io/clinic-ja/` works without a base-path change. The site must be HTTPS or the browser will refuse the microphone.

On Android, use the browser menu and choose “Add to Home screen” or “Install app”. On iPhone, open the site in Safari, tap Share, then “Add to Home Screen”.

The first launch downloads the Japanese reading dictionary (about 18MB). A service worker keeps it after that. Translation itself still needs a network.

## What the therapist sees

- Japanese, very large, for the patient.
- Hangul pronunciation under it, for the therapist (`오시리오 아게테 쿠다사이`).
- The original Korean, smaller.
- A speaker button, and tapping the card, speaks Japanese slowly (`ja-JP`, rate 0.82).
- “끝나면 읽어 주기” speaks each new card automatically. It is off by default.
- “자주 쓰는 말” inserts common treatment lines without using the mic.
- The text field works even when speech recognition does not.

Listening keeps going until Stop. Chrome on Android ends a recognition session on its own; the app starts it again. iPhone Safari cannot hold one continuous session, so each sentence ends the session and the app starts another.

While listening, the screen stays awake through the Wake Lock API. On older iOS, where Wake Lock is missing, it falls back to a silent inline video. If neither works, the app says so and asks you to turn off auto-lock.

## Hangul

This is a pronunciation guide, not Korean loanword spelling. カ is always 카/키/쿠/케/코, long vowels are written twice so they are held (`오오키쿠`), っ is ㅅ batchim (`윳쿠리`, `슷테`), and ん is ㅇ before k/g and ㄴ otherwise. Particles は / へ / を are read 와 / 에 / 오.

Checked lines:

| Korean | Japanese | Hangul |
| --- | --- | --- |
| 엉덩이 들어보세요 | お尻を上げてください | 오시리오 아게테 쿠다사이 |
| 숨 크게 쉬세요 | 息を大きく吸ってください | 이키오 오오키쿠 슷테 쿠다사이 |
| 아프면 말씀해 주세요 | 痛い場合は教えてください | 이타이 바아이와 오시에테 쿠다사이 |
| 천천히 일어나세요 | ゆっくり起きてください | 윳쿠리 오키테 쿠다사이 |
| 무릎 펴세요 | 膝を伸ばしてください | 히자오 노바시테 쿠다사이 |

A few Korean words are ambiguous in the clinic (`들다` lift/listen, `쉬다` breathe/rest, `배` belly/boat). Those common lines are pinned to the polite rehab Japanese above instead of a literal dictionary translation. Other sentences go through the translator, and a plain verb such as `伸ばす` is rewritten to `伸ばしてください` when the Korean was a request.

## Limits

**Android Chrome and Samsung Internet.** Speech recognition works and is restarted whenever Chrome drops the session. You need a microphone permission, HTTPS, and a network (recognition is done by Google’s speech service, not on the device). Interim Korean text shows while a sentence is still being heard.

**iPhone Safari, and Chrome on iPhone.** Every iOS browser uses WebKit. `webkitSpeechRecognition` exists only on newer iOS, ignores a reliable continuous mode, and must be started from a tap. The app starts a fresh session after each result. If iOS blocks the restart, it asks for another tap instead of spinning. This was not run on a physical iPhone here; the iOS branch is covered by the platform tests and the same card pipeline.

**Speaking.** Android uses Google’s Japanese voice when it is installed. iOS loads Kyoko or Otoya asynchronously, and the first utterance has to come from a tap or iOS stays silent. Auto-speak works after the mic, a preset, or the toggle has been tapped. Long utterances on iOS are nudged so they do not stall.

**Wake lock.** Supported in Chrome on Android and Safari 16.4 and later. Older iOS tries the silent-video fallback. Anything else shows a Korean notice.

**Translation.** Needs a network and no key. The app calls `clients5.google.com` (`client=dict-chrome-ex`) and, if that fails, `translate.googleapis.com/translate_a/single?client=gtx`. Both can rate-limit. A failed card keeps the Korean and offers “다시 번역”.

**Firefox and in-app browsers** usually have no speech recognition. The Korean banner explains that, and the text field still translates.
