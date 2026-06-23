# Cafe WiFi Timer

カフェWi-Fiの接続終了時刻を忘れないためのChrome拡張機能です。Manifest V3、Vanilla HTML/CSS/JavaScriptのみで構成しています。

収益性と公開コストを理由に開発停止

## 機能

- カフェ設定の登録、編集、削除
- 設定項目: カフェ名、接続時間、任意のログインページURL
- 登録カフェまたは任意の分数でタイマー開始
- ポップアップでカフェ名、残り時間、終了予定時刻を表示
- 拡張機能アイコンのバッジに残り分数を表示
- 5分前、1分前、終了時にChrome通知
- タイマーの停止とリセット
- `chrome.storage.local`に終了予定の絶対時刻を保存
- Chromeやポップアップを閉じた後、PCスリープ後も終了予定時刻から残り時間を復元
- 登録されたログインページURLへのアクセス検出とタイマー開始提案通知

## ファイル構成

- `manifest.json`: Chrome拡張の設定
- `background.js`: service worker、alarms、通知、バッジ、ログインページ検出
- `common.js`: storageキー、タイマー状態、日付表示、URL判定などの共通処理
- `popup.html`: タイマー操作ポップアップ
- `popup.css`: ポップアップUI
- `popup.js`: ポップアップの状態表示と操作
- `options.html`: カフェ設定画面
- `options.css`: 設定画面UI
- `options.js`: カフェ設定の保存、編集、削除
- `icons/icon.svg`: 拡張機能アイコンの元データ
- `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png`, `icons/icon128.png`: Chrome拡張で使用するPNGアイコン
- `PRIVACY.md`: プライバシーポリシー
- `LICENSE`: ライセンス
- `.gitignore`: Git除外設定

## ローカルでのインストール方法

1. Chromeで `chrome://extensions` を開く
2. 右上の「デベロッパー モード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」を選択
4. このリポジトリのフォルダを選択
5. ツールバーに表示されたCafe WiFi Timerのアイコンからポップアップを開く

## 必要な権限とその理由

- `storage`: カフェ設定とタイマー状態を端末内の `chrome.storage.local` に保存するため
- `alarms`: service workerが停止していても終了予定時刻と事前通知を処理するため
- `notifications`: 5分前、1分前、終了時、ログインページ検出時に通知するため
- `tabs`: タブのURL更新を受け取り、登録済みログインページURLと照合するため
- `optional_host_permissions`: ログインページURLが登録された場合だけ、該当オリジンの検出許可をユーザー操作で要求するため

## 現時点での制限

- Wi-Fiへの自動ログイン、接続延長、時間制限回避は行いません。
- ログインページ検出は、登録URLと同じオリジンかつ同じパス配下へのアクセスだけを対象にします。
- 通知の表示可否はChromeとOSの通知設定に依存します。
- バッジは分単位表示です。ポップアップを開いている間だけ秒単位で更新します。
- アイコンは16/32/48/128pxのPNGを同梱しています。公開前にストア掲載用画像は別途用意してください。

## Chrome Web Store公開手順

1. Chrome Web Store Developer Dashboardで開発者登録を行う
2. `manifest.json` の `version`、説明文、権限を確認する
3. 必要に応じてPNGアイコン、スクリーンショット、プロモーション画像を用意する
4. 拡張機能フォルダをZIP化する
5. Dashboardで新しいアイテムを作成し、ZIPをアップロードする
6. プライバシー項目で、データがローカル保存のみで外部送信されないことを申告する
7. 権限の用途を説明し、審査へ提出する
