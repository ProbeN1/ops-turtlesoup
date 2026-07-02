# UI Smoke Runbook

Use this runbook to verify the browser experience before sharing the intranet game link.

## Preconditions

- Service is running.
- `npm run verify:deploy` passes without `FAIL`.
- `npm run smoke:app` passes.
- Open the game URL in a real browser from the release host or a coworker intranet machine.

## Manual Browser Flow

1. Open:

```text
http://<server-intranet-ip>:5725/
```

2. Confirm the first screen shows:

- title: `运维海龟汤`;
- status: `待开始`;
- question-bank selector with `交付故障`, `方案澄清`;
- difficulty selector with `简单`, `中等`, `困难`;
- `题库` appears to the left of `难度` on the same row;
- `开始` and `揭晓` appear on a second row, with horizontal text;
- right-bottom badge shows `更新记录`, `反馈`, and compact `v0.1`;
- disabled question input before a game starts.

3. Select `中等`, then click `开始`.

Expected:

- status changes to `进行中`;
- the incident opening is replaced with a concrete story;
- question input and `提问` button are enabled;
- `揭晓` button is enabled.

4. Ask:

```text
这和用户量暴涨有关吗？
```

Expected:

- player message appears;
- host returns one allowed answer for the selected difficulty;
- input clears and remains usable.

5. Confirm the page fits the browser at 100% zoom on a common PC viewport.

Expected:

- there is no document-level vertical scroll on the game page;
- the chat log scrolls inside the embedded conversation window when messages overflow;
- the `提问` button remains in the same position.

6. Open `更新记录`, then return to the game.

Expected:

- the update log page loads;
- the page mentions `首页布局优化`;
- `返回游戏` goes back to `/`.

7. Click `揭晓`.

Expected:

- status changes to `已揭晓`;
- answer payload appears;
- `基础设施：` is readable text, not `[object Object]`;
- `真相：`, `关键点：`, and `经验：` are visible;
- question input and `提问` button are disabled.

8. Start an easy round until the `/data` backup scenario appears, then submit:

```text
备份压缩包落在 /data，上传完成后临时压缩文件被删除，所以磁盘自动回落。
```

Expected:

- status changes to `已破案`;
- reveal message appears with title `破案`;
- 庆祝动画短暂出现;
- `揭晓` button is disabled after solve.

## Current Verification Record

Date: 2026-07-02

Environment:

- URL: `http://127.0.0.1:5725/`
- Browser: in-app browser or Chrome

Observed:

- page title and H1: `运维海龟汤`;
- question-bank selector appears before difficulty selector;
- start/reveal buttons stay on a separate horizontal action row;
- the game page fits a 1280x720 PC viewport without document-level scrolling;
- update log link opens successfully;
- reveal rendered infrastructure without `[object Object]`;
- solved easy `/data` backup scenario;
- celebration layer showed briefly and then hid;
- final status: `已破案`.

## Notes

Standalone Playwright automation was not added because the bundled Playwright browser binary was not installed on this machine. Keep this runbook as the release gate until browser binaries are available on the verification host.
