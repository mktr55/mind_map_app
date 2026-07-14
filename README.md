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
4. `mindflow-data` の `mindflow/workspace.json` に保存

## Obsidian / iCloud にミラー保存

iPhone からは GitHub に同期し、Mac 側のスクリプトが Obsidian の iCloud フォルダへ Markdown と JSON をミラー保存します。

```bash
export MINDFLOW_GITHUB_TOKEN=ghp_...
export MINDFLOW_GITHUB_OWNER=your-github-user
npm run sync:obsidian
```

常駐同期する場合:

```bash
export MINDFLOW_GITHUB_TOKEN=ghp_...
export MINDFLOW_GITHUB_OWNER=your-github-user
npm run watch:obsidian
```

既定の保存先:

```text
/Users/kz/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian_from_Mac/10_Notes/mindmap
```

出力内容:

- `mindflow-workspace.json`: アプリ復元用の全ワークスペース
- `*.md`: Obsidian で読めるマップごとのアウトライン
- `*.json`: マップごとの復元用データ

## Token 権限

- fine-grained PAT の場合:
  - 対象 repo: `mktr55/mindflow-data`
  - `Contents: Read and write`
  - `Metadata: Read`

## メモ

- GitHub Pages 自体は公開 URL ですが、データ同期にはあなたの token が必要です
- トークンは端末の `localStorage` に保存されます
