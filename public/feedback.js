const copyStatus = document.querySelector("#copyStatus");
const copyButtons = document.querySelectorAll("[data-copy-target]");

for (const button of copyButtons) {
  button.addEventListener("click", () => copyTargetText(button));
}

async function copyTargetText(button) {
  const target = document.querySelector(`#${button.dataset.copyTarget}`);
  const text = target?.textContent?.trim() || "";
  if (!text) return;

  showStatus("正在复制...");
  try {
    await copyText(text);
    showStatus("已复制，可以发钉钉了。");
  } catch {
    selectTargetText(target);
    showStatus("已选中，请按 Ctrl+C 复制。");
  }
}

async function copyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (copied) return;

  if (navigator.clipboard?.writeText) {
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error("copy timeout")), 1000))
    ]);
    return;
  }

  throw new Error("copy failed");
}

function selectTargetText(target) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(target);
  selection.removeAllRanges();
  selection.addRange(range);
}

function showStatus(message) {
  copyStatus.textContent = message;
  window.clearTimeout(showStatus.timer);
  showStatus.timer = window.setTimeout(() => {
    copyStatus.textContent = "";
  }, 2200);
}
