# MindFlow

スマホでも使える、GitHub Pages 配信の個人用マインドマップです。

## いまの構成

- フロントエンドは完全な静的サイトです
- GitHub Pages にそのままデプロイできます
- 初回アクセス時に GitHub personal access token を入力すると、`mktr55/mindflow-data` にマップを同期します
- トークンを持っていない人は同期できないので、実質的に自分専用で使えます

## ローカル起動

```bash
node node_modules/vite/bin/vite.js
```

## GitHub で使う流れ

1. このリポジトリを GitHub に push
2. GitHub Pages を有効化
3. 初回アクセス時に GitHub token を入力
4. `mktr55/mindflow-data` の `mindflow/mindflow.json` に保存

## Token 権限

- fine-grained PAT の場合:
  - 対象 repo: `mktr55/mindflow-data`
  - `Contents: Read and write`
  - `Metadata: Read`

## メモ

- GitHub Pages 自体は公開 URL ですが、データ同期にはあなたの token が必要です
- トークンは端末の `localStorage` に保存されます
