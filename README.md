# solar-lag-3d

夏至（昼が一番長い日）と日没最遅日にズレが生じる現象を、3D で可視化するシミュレーターです。地軸の傾き・離心率・近日点の位置・緯度を変えて、「どういう条件ならズレないか」を比べられます。計算は既存の天文ライブラリに頼らず、任意のパラメータから自前で行います。

- 公開ページ：https://pyonkichi499.github.io/solar-lag-3d/
- 使い方と、ズレが起きる仕組み：[docs/guide.md](docs/guide.md)
- 要件定義・設計：[docs/requirements.md](docs/requirements.md)
- 将来の課題：[docs/backlog.md](docs/backlog.md)

## 開発

```sh
corepack enable
pnpm install
pnpm dev       # 開発サーバー
pnpm test      # テスト
pnpm lint      # Biome
pnpm build     # 本番ビルド
```

## ライセンス

MIT
