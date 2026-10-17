# テスト記録 (2026-10-17)

- Node.jsの判定・権限・ローカル検証ケース: 13件合格 (`node --test tests/*.mjs`)
- JavaScript構文検査: `background.js`、`popup.js`、`link-guard.js` は合格。
- マニフェストJSONを読み込み、Manifest V3、初期権限 `activeTab`、任意権限 `tabs` と `scripting`、任意のHTTP/HTTPS全サイトアクセス、拡張機能バージョン `0.3.0` を確認。
- `git diff --check` は合格。
- Pythonローカルサーバ試験: 3件合格 (`python -m unittest discover -s tests -p 'test_local_server.py'`)
- 公開フォルダ内のGitHub Actionsワークフローはありません。
- Windows版Chromeでの権限確認、ページ内リンク表示、クリック介入、読み込み時表示の実機確認は未実施です。
- Unicode UTS #39の網羅的準拠確認、誤検知評価、第三者監査も未実施です。
