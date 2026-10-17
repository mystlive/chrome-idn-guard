# テスト記録 (2026-10-17)

- Node.jsの判定・権限・ローカル検証ケース: 12件合格 (`node --test tests/*.mjs`)
- Pythonローカルサーバ試験: 3件合格 (`python -m unittest discover -s tests -p 'test_local_server.py'`)
- マニフェストJSONを読み込み、Manifest V3、初期権限 `activeTab`、任意権限 `tabs`、拡張機能バージョン `0.2.0` を確認。
- 公開フォルダ内のGitHub Actionsワークフローはありません。
- Windows版Chromeでのインストール・ポップアップ・自動監視の実機確認は未実施です。
- Unicode UTS #39の網羅的準拠確認、誤検知評価、第三者監査も未実施です。
