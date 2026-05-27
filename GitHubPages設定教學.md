# GitHub Pages 設定教學

目前 GitHub 顯示：

```text
GitHub Pages is currently disabled.
You must first add content to your repository before you can publish a GitHub Pages site.
```

原因是 repo 還沒有可發佈的前端內容。

本專案已建立：

- `docs/index.html`
- `docs/config.js`

因此可以用 `main / docs` 發佈 GitHub Pages。

## 設定步驟

1. 先把本機專案 commit 並 push 到 GitHub。
2. 到 GitHub repo。
3. 點 `Settings`。
4. 左側點 `Pages`。
5. 在 `Build and deployment` 區塊：
   - `Source` 選 `Deploy from a branch`
   - `Branch` 選 `main`
   - 資料夾選 `/docs`
6. 點 `Save`。
7. 等 1-3 分鐘。
8. 頁面會顯示 GitHub Pages 網址。

網址通常會是：

```text
https://joedler.github.io/<repo-name>/
```

這個網址之後要填到 LINE Developers 的 LIFF `Endpoint URL`。

## Enforce HTTPS

使用 `joedler.github.io` 預設網域時，GitHub 會要求 HTTPS。

保持預設即可。

## Custom domain

本案第一版先不用設定 Custom domain。

未來如果要使用自有網域，例如：

```text
trip.example.com
```

再設定 Custom domain 與 DNS。

## 注意事項

- `docs/index.html` 必須存在。
- GitHub Pages 只能直接選 `/root` 或 `/docs`，不能直接選 `web/`。
- 若未來前端放在 `web/`，可用 GitHub Actions build 後部署到 Pages。
- 第一版為了快速穩定，先使用 `/docs`。
